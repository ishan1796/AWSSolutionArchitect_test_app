import sqlite3
import json
import os
import shutil
from datetime import datetime

DATABASE_DIR = os.path.join(os.path.dirname(__file__), 'database')
DATABASE_PATH = os.path.join(DATABASE_DIR, 'quiz.db')

# If running on Vercel, copy the pre-existing db to /tmp/quiz.db (which is writable)
if os.environ.get('VERCEL') == '1' or os.environ.get('VERCEL_ENV'):
    VERCEL_DB_PATH = '/tmp/quiz.db'
    if not os.path.exists(VERCEL_DB_PATH):
        # Create /tmp directory if not exists
        os.makedirs('/tmp', exist_ok=True)
        # If the repository database exists, copy it as seed
        if os.path.exists(DATABASE_PATH):
            shutil.copy2(DATABASE_PATH, VERCEL_DB_PATH)
    # Set the DATABASE_PATH to the writable /tmp path
    DATABASE_PATH = VERCEL_DB_PATH

def get_part_for_id(q_id):
    """
    Returns the part number (1 to 4) for a given SAA-C03 question ID.
    """
    if 1 <= q_id <= 180:
        return 1
    elif 201 <= q_id <= 230:
        return 2
    elif (181 <= q_id <= 200) or (231 <= q_id <= 250) or (281 <= q_id <= 300) or (331 <= q_id <= 350):
        return 3
    elif 371 <= q_id <= 672:
        return 4
    else:
        return None

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def normalize_options(options):
    lst = []
    if isinstance(options, list):
        lst = options
    elif isinstance(options, dict):
        sorted_keys = sorted(options.keys())
        lst = [options[k] for k in sorted_keys]
    elif isinstance(options, str):
        try:
            val = json.loads(options)
            return normalize_options(val)
        except Exception:
            lst = [options]
            
    cleaned_lst = []
    for opt in lst:
        if isinstance(opt, str):
            opt_cleaned = opt.strip()
            for i in range(1, 10):
                topic_tag = f"Topic {i}"
                if opt_cleaned.endswith(topic_tag):
                    opt_cleaned = opt_cleaned[:-len(topic_tag)].strip()
            cleaned_lst.append(opt_cleaned)
        else:
            cleaned_lst.append(opt)
    return cleaned_lst

def init_db():
    """
    Initializes the SQLite database tables if they do not exist.
    """
    db_dir = os.path.dirname(DATABASE_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Create questions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY,
            part INTEGER,
            question_text TEXT NOT NULL,
            options TEXT NOT NULL, -- JSON serialized list of options
            correct_answer TEXT NOT NULL, -- "A", "B", "A,B", etc.
            explanation TEXT,
            tags TEXT,
            difficulty TEXT
        )
    ''')

    # Create progress table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS progress (
            part INTEGER PRIMARY KEY,
            current_question_id INTEGER DEFAULT -1, -- Stores the current active question_id in the part
            score INTEGER DEFAULT 0,
            attempted INTEGER DEFAULT 0,
            skipped INTEGER DEFAULT 0,
            wrong_answers INTEGER DEFAULT 0,
            accuracy REAL DEFAULT 0.0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create user_answers table for tracking individual question status
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_answers (
            question_id INTEGER PRIMARY KEY,
            part INTEGER,
            selected_options TEXT, -- JSON list or comma-separated selected options
            is_correct INTEGER DEFAULT 0, -- 0 or 1
            is_bookmarked INTEGER DEFAULT 0, -- 0 or 1
            answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create user_streaks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_streaks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            streak_count INTEGER DEFAULT 0,
            last_active_date TEXT UNIQUE -- Format YYYY-MM-DD
        )
    ''')

    # Create user_badges table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_badges (
            badge_id TEXT PRIMARY KEY,
            badge_name TEXT NOT NULL,
            description TEXT NOT NULL,
            earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Populate progress records for parts 1 to 4 if they don't exist
    for p in range(1, 5):
        cursor.execute('INSERT OR IGNORE INTO progress (part) VALUES (?)', (p,))

    conn.commit()
    conn.close()

def seed_db():
    """
    Seeds the database with default questions from default_questions.json if questions table is empty.
    """
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if questions already exist
    cursor.execute('SELECT COUNT(*) FROM questions')
    if cursor.fetchone()[0] > 0:
        conn.close()
        return

    # Load from default_questions.json
    json_path = os.path.join(os.path.dirname(__file__), 'data', 'default_questions.json')
    if not os.path.exists(json_path):
        conn.close()
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        questions = json.load(f)

    for q in questions:
        q_id = int(q['id'])
        part_id = get_part_for_id(q_id)
        
        # Parse options: support list, dict, or JSON string
        options_val = q['options']
        options_list = normalize_options(options_val)
        options_str = json.dumps(options_list)

        cursor.execute('''
            INSERT OR REPLACE INTO questions (id, part, question_text, options, correct_answer, explanation, tags, difficulty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            q_id,
            part_id,
            q['question_text'],
            options_str,
            q['correct_answer'],
            q.get('explanation', ''),
            q.get('tags', ''),
            q.get('difficulty', 'Medium')
        ))

    conn.commit()
    conn.close()

def import_questions_from_json(json_data):
    """
    Bulk imports questions from a list of dictionaries (JSON data)
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    imported_count = 0

    for q in json_data:
        try:
            q_id = int(q['id'])
            part_id = get_part_for_id(q_id)
            if part_id is None:
                continue

            options_val = q['options']
            options_list = normalize_options(options_val)
            options_str = json.dumps(options_list)

            cursor.execute('''
                INSERT OR REPLACE INTO questions (id, part, question_text, options, correct_answer, explanation, tags, difficulty)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                q_id,
                part_id,
                q['question_text'],
                options_str,
                q['correct_answer'],
                q.get('explanation', ''),
                q.get('tags', ''),
                q.get('difficulty', 'Medium')
            ))
            imported_count += 1
        except Exception as e:
            print(f"Error importing question: {e}")
            continue

    conn.commit()
    conn.close()
    return imported_count
