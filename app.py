import os
import json
from datetime import datetime, date, timedelta
from flask import Flask, render_template, jsonify, request, redirect, url_for
from db import get_db_connection, seed_db, get_part_for_id

app = Flask(__name__)

# Initialize and seed database
seed_db()

# Define badges data
BADGES = {
    'first_blood': {
        'name': 'First Blood',
        'description': 'Answered your first AWS SAA-C03 question.'
    },
    'perfectionist': {
        'name': 'Perfectionist',
        'description': 'Answered 5 consecutive questions correctly.'
    },
    'speed_demon': {
        'name': 'Speed Demon',
        'description': 'Answered a question correctly in under 5 seconds.'
    },
    'streak_3': {
        'name': 'Consistent',
        'description': 'Maintained a 3-day active streak.'
    },
    'part_1_finisher': {
        'name': 'Part 1 Graduate',
        'description': 'Completed all questions in Part 1.'
    },
    'aws_expert': {
        'name': 'Cloud Expert',
        'description': 'Achieved an accuracy of 80% or higher with at least 10 questions attempted.'
    }
}

def check_and_award_badges(cursor):
    """
    Checks user statistics and awards badges. Returns list of newly earned badge codes.
    """
    earned_badges = []
    
    # 1. First Blood badge
    cursor.execute("SELECT COUNT(*) FROM user_answers WHERE selected_options IS NOT NULL")
    total_answered = cursor.fetchone()[0]
    if total_answered >= 1:
        cursor.execute("INSERT OR IGNORE INTO user_badges (badge_id, badge_name, description) VALUES (?, ?, ?)",
                       ('first_blood', BADGES['first_blood']['name'], BADGES['first_blood']['description']))
        if cursor.rowcount > 0:
            earned_badges.append('first_blood')

    # 2. Perfectionist badge
    # Check last 5 answers
    cursor.execute("SELECT is_correct FROM user_answers ORDER BY answered_at DESC LIMIT 5")
    last_answers = [row[0] for row in cursor.fetchall()]
    if len(last_answers) == 5 and all(last_answers):
        cursor.execute("INSERT OR IGNORE INTO user_badges (badge_id, badge_name, description) VALUES (?, ?, ?)",
                       ('perfectionist', BADGES['perfectionist']['name'], BADGES['perfectionist']['description']))
        if cursor.rowcount > 0:
            earned_badges.append('perfectionist')

    # 3. AWS Expert badge
    cursor.execute("SELECT COUNT(*), SUM(is_correct) FROM user_answers")
    row = cursor.fetchone()
    total = row[0] if row else 0
    correct = row[1] if row and row[1] is not None else 0
    if total >= 10:
        accuracy = (correct / total) * 100
        if accuracy >= 80:
            cursor.execute("INSERT OR IGNORE INTO user_badges (badge_id, badge_name, description) VALUES (?, ?, ?)",
                           ('aws_expert', BADGES['aws_expert']['name'], BADGES['aws_expert']['description']))
            if cursor.rowcount > 0:
                earned_badges.append('aws_expert')

    # 4. Streak 3 badge
    cursor.execute("SELECT streak_count FROM user_streaks ORDER BY id DESC LIMIT 1")
    streak_row = cursor.fetchone()
    streak = streak_row[0] if streak_row else 0
    if streak >= 3:
        cursor.execute("INSERT OR IGNORE INTO user_badges (badge_id, badge_name, description) VALUES (?, ?, ?)",
                       ('streak_3', BADGES['streak_3']['name'], BADGES['streak_3']['description']))
        if cursor.rowcount > 0:
            earned_badges.append('streak_3')

    # 5. Part 1 Finisher badge
    cursor.execute("SELECT COUNT(*) FROM questions WHERE part = 1")
    total_p1 = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM user_answers WHERE part = 1 AND selected_options IS NOT NULL")
    answered_p1 = cursor.fetchone()[0]
    if total_p1 > 0 and answered_p1 == total_p1:
        cursor.execute("INSERT OR IGNORE INTO user_badges (badge_id, badge_name, description) VALUES (?, ?, ?)",
                       ('part_1_finisher', BADGES['part_1_finisher']['name'], BADGES['part_1_finisher']['description']))
        if cursor.rowcount > 0:
            earned_badges.append('part_1_finisher')

    return earned_badges

def update_streak_db(cursor):
    """
    Updates the user active streak.
    """
    today_str = date.today().isoformat()
    yesterday_str = (date.today() - timedelta(days=1)).isoformat()
    
    # Get last streak entry
    cursor.execute("SELECT streak_count, last_active_date FROM user_streaks ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    
    if not row:
        # First entry ever
        cursor.execute("INSERT INTO user_streaks (streak_count, last_active_date) VALUES (?, ?)", (1, today_str))
        return 1
    
    last_streak, last_date = row[0], row[1]
    
    if last_date == today_str:
        # Already logged today
        return last_streak
    elif last_date == yesterday_str:
        # Consecutive day
        new_streak = last_streak + 1
        cursor.execute("INSERT OR REPLACE INTO user_streaks (streak_count, last_active_date) VALUES (?, ?)", (new_streak, today_str))
        return new_streak
    else:
        # Streak broken
        cursor.execute("INSERT OR REPLACE INTO user_streaks (streak_count, last_active_date) VALUES (?, ?)", (1, today_str))
        return 1

# --- VIEW ROUTES ---

@app.route('/')
def dashboard():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch progress for each part
    parts_data = {}
    for p in range(1, 5):
        # Total questions available in DB for this part
        cursor.execute("SELECT COUNT(*) FROM questions WHERE part = ?", (p,))
        total_questions = cursor.fetchone()[0]
        
        # User progress stats
        cursor.execute("SELECT current_question_id, score, attempted, skipped, wrong_answers, accuracy FROM progress WHERE part = ?", (p,))
        prog = cursor.fetchone()
        
        if prog:
            current_q_id, score, attempted, skipped, wrong, accuracy = prog
        else:
            current_q_id, score, attempted, skipped, wrong, accuracy = -1, 0, 0, 0, 0, 0.0
            
        completion_rate = 0.0
        if total_questions > 0:
            completion_rate = round((attempted / total_questions) * 100, 1)
            
        parts_data[p] = {
            'total_questions': total_questions,
            'current_question_id': current_q_id,
            'score': score,
            'attempted': attempted,
            'skipped': skipped,
            'wrong_answers': wrong,
            'accuracy': round(accuracy, 1),
            'completion': completion_rate
        }

    # Fetch global stats
    cursor.execute("SELECT COUNT(*) FROM user_answers WHERE selected_options IS NOT NULL")
    global_attempted = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM user_answers WHERE is_correct = 1")
    global_correct = cursor.fetchone()[0]
    
    global_accuracy = 0.0
    if global_attempted > 0:
        global_accuracy = round((global_correct / global_attempted) * 100, 1)

    # Streak
    cursor.execute("SELECT streak_count, last_active_date FROM user_streaks ORDER BY id DESC LIMIT 1")
    streak_row = cursor.fetchone()
    streak = 0
    if streak_row:
        # Check if last active was today or yesterday to consider active
        last_date = datetime.strptime(streak_row[1], "%Y-%m-%d").date()
        if last_date >= date.today() - timedelta(days=1):
            streak = streak_row[0]
            
    # Badges
    cursor.execute("SELECT badge_id, badge_name, description, earned_at FROM user_badges ORDER BY earned_at DESC")
    badges = [dict(row) for row in cursor.fetchall()]

    conn.close()
    
    return render_template('dashboard.html', 
                           parts=parts_data, 
                           global_attempted=global_attempted, 
                           global_accuracy=global_accuracy,
                           streak=streak,
                           badges=badges)

@app.route('/quiz/<int:part_id>')
def quiz(part_id):
    if part_id not in [1, 2, 3, 4]:
        return redirect(url_for('dashboard'))
    return render_template('quiz.html', part_id=part_id)

@app.route('/stats')
def stats_page():
    return render_template('stats.html')

# --- API ROUTES ---

@app.route('/api/questions/<int:part_id>', methods=['GET'])
def get_questions(part_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get all questions for this part
    cursor.execute("SELECT id, question_text, options, correct_answer, explanation, tags, difficulty FROM questions WHERE part = ? ORDER BY id ASC", (part_id,))
    rows = cursor.fetchall()
    
    questions = []
    for r in rows:
        q = dict(r)
        q['options'] = json.loads(q['options'])
        questions.append(q)
        
    # Get user answers for this part
    cursor.execute("SELECT question_id, selected_options, is_correct, is_bookmarked FROM user_answers WHERE part = ?", (part_id,))
    ans_rows = cursor.fetchall()
    user_answers = {r['question_id']: dict(r) for r in ans_rows}
    
    # Get current saved progress
    cursor.execute("SELECT current_question_id, score, attempted, skipped, wrong_answers, accuracy FROM progress WHERE part = ?", (part_id,))
    prog_row = cursor.fetchone()
    progress = dict(prog_row) if prog_row else {}
    
    conn.close()
    return jsonify({
        'questions': questions,
        'user_answers': user_answers,
        'progress': progress
    })

@app.route('/api/answer', methods=['POST'])
def save_answer():
    data = request.json
    q_id = int(data['question_id'])
    part_id = int(data['part'])
    selected_options = data['selected_options']
    is_correct = int(data['is_correct'])
    is_skipped = data.get('is_skipped', False)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if already answered
    cursor.execute("SELECT selected_options FROM user_answers WHERE question_id = ?", (q_id,))
    existing = cursor.fetchone()
    
    # Save/Update user_answers
    # Preserve bookmark status if it exists
    cursor.execute("INSERT INTO user_answers (question_id, part, selected_options, is_correct) VALUES (?, ?, ?, ?) "
                   "ON CONFLICT(question_id) DO UPDATE SET selected_options=excluded.selected_options, is_correct=excluded.is_correct",
                   (q_id, part_id, json.dumps(selected_options) if selected_options else None, is_correct))
    
    # Update active streak
    streak = update_streak_db(cursor)
    
    # Re-calculate part stats
    # Find all answered questions in this part
    cursor.execute("SELECT COUNT(*), SUM(is_correct) FROM user_answers WHERE part = ? AND selected_options IS NOT NULL", (part_id,))
    ans_stats = cursor.fetchone()
    attempted = ans_stats[0] if ans_stats else 0
    correct = ans_stats[1] if ans_stats and ans_stats[1] is not None else 0
    wrong = attempted - correct
    
    accuracy = 0.0
    if attempted > 0:
        accuracy = (correct / attempted) * 100
        
    # Skipped count
    cursor.execute("SELECT COUNT(*) FROM progress WHERE part = ?", (part_id,))
    # We update the progress database row
    cursor.execute('''
        UPDATE progress 
        SET current_question_id = ?, score = ?, attempted = ?, wrong_answers = ?, accuracy = ?, last_updated = CURRENT_TIMESTAMP
        WHERE part = ?
    ''', (q_id, correct, attempted, wrong, accuracy, part_id))
    
    # Award badges
    new_badges = check_and_award_badges(cursor)
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'status': 'success',
        'streak': streak,
        'new_badges': new_badges,
        'stats': {
            'attempted': attempted,
            'score': correct,
            'wrong_answers': wrong,
            'accuracy': accuracy
        }
    })

@app.route('/api/update_progress/<int:part_id>', methods=['POST'])
def update_progress(part_id):
    data = request.json
    q_id = int(data['current_question_id'])
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("UPDATE progress SET current_question_id = ?, last_updated = CURRENT_TIMESTAMP WHERE part = ?", (q_id, part_id))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/bookmark', methods=['POST'])
def toggle_bookmark():
    data = request.json
    q_id = int(data['question_id'])
    is_bookmarked = int(data['is_bookmarked'])
    
    # Find the part for this question ID
    part_id = get_part_for_id(q_id)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO user_answers (question_id, part, is_bookmarked) 
        VALUES (?, ?, ?)
        ON CONFLICT(question_id) DO UPDATE SET is_bookmarked = excluded.is_bookmarked
    ''', (q_id, part_id, is_bookmarked))
    
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/reset/<int:part_id>', methods=['POST'])
def reset_part(part_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Reset progress table
    cursor.execute('''
        UPDATE progress 
        SET current_question_id = -1, score = 0, attempted = 0, skipped = 0, wrong_answers = 0, accuracy = 0.0, last_updated = CURRENT_TIMESTAMP
        WHERE part = ?
    ''', (part_id,))
    
    # Clear answers for this part
    cursor.execute("DELETE FROM user_answers WHERE part = ?", (part_id,))
    
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/stats', methods=['GET'])
def get_global_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get total count of questions by tags
    cursor.execute("SELECT tags FROM questions")
    all_tags = {}
    total_answers_by_tag = {}
    correct_answers_by_tag = {}
    
    for row in cursor.fetchall():
        tags_str = row['tags'] or ''
        tags = [t.strip() for t in tags_str.split(',') if t.strip()]
        for tag in tags:
            all_tags[tag] = all_tags.get(tag, 0) + 1
            
    # Get answers joined with question tags
    cursor.execute('''
        SELECT q.tags, a.is_correct 
        FROM user_answers a 
        JOIN questions q ON a.question_id = q.id 
        WHERE a.selected_options IS NOT NULL
    ''')
    
    for row in cursor.fetchall():
        tags_str = row['tags'] or ''
        is_correct = row['is_correct']
        tags = [t.strip() for t in tags_str.split(',') if t.strip()]
        for tag in tags:
            total_answers_by_tag[tag] = total_answers_by_tag.get(tag, 0) + 1
            if is_correct:
                correct_answers_by_tag[tag] = correct_answers_by_tag.get(tag, 0) + 1
                
    # Calculate weakness analysis (lowest accuracy tags with at least 2 attempts)
    tag_analysis = []
    for tag, total in total_answers_by_tag.items():
        correct = correct_answers_by_tag.get(tag, 0)
        accuracy = (correct / total) * 100
        tag_analysis.append({
            'tag': tag,
            'total_questions': all_tags.get(tag, 0),
            'attempted': total,
            'accuracy': round(accuracy, 1),
            'correct': correct
        })
        
    tag_analysis = sorted(tag_analysis, key=lambda x: x['accuracy'])
    
    # Parts completion breakdown
    parts = []
    for p in range(1, 5):
        cursor.execute("SELECT COUNT(*) FROM questions WHERE part = ?", (p,))
        total = cursor.fetchone()[0]
        cursor.execute("SELECT score, attempted, accuracy FROM progress WHERE part = ?", (p,))
        prog = cursor.fetchone()
        parts.append({
            'part': p,
            'total': total,
            'attempted': prog[1] if prog else 0,
            'correct': prog[0] if prog else 0,
            'accuracy': round(prog[2], 1) if prog else 0.0
        })
        
    conn.close()
    return jsonify({
        'tags_stats': tag_analysis,
        'parts_stats': parts
    })

@app.route('/api/import', methods=['POST'])
def import_questions():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        if not isinstance(data, list):
            # Try parsing a dict if it contains questions key
            if isinstance(data, dict) and 'questions' in data:
                data = data['questions']
            else:
                return jsonify({'error': 'JSON must be a list of questions or an object containing a "questions" list'}), 400
                
        from db import import_questions_from_json
        imported = import_questions_from_json(data)
        return jsonify({'status': 'success', 'imported_count': imported})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, debug=True)
