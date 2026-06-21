# AWS SAA-C03 Quiz Platform
# https://aws-solution-architect-test-app.vercel.app/

please drop a star if it was helpful

A premium offline-first certification quiz engine built with Python Flask and SQLite, designed with a modern Cyberpunk Dark Mode UI.

## Features

- **Decoupled Quiz Structures:** Play Part 1 (1-180), Part 2 (201-230), Part 3 (181-200, 231-250, 281-300, 331-350), and Part 4 (371-672) independently with separate progress.
- **Modern Cyberpunk UI:** Beautiful glassmorphism panels, glowing neon highlights (Correct = Green, Incorrect = Red, Bookmarks = Yellow), smooth translations, and hover keyframes.
- **Offline Audio Synth:** Powered by native browser Web Audio API, synthesizing clicks, sweeps, and fanfare entirely offline.
- **Keyboard Navigation:** Select options with `A`-`D`, check/advance with `Enter`, bookmark with `K`, and navigate with Arrow Keys.
- **Analytics & Weak Point Diagnostics:** Detailed breakdown of performance by AWS service tags, tracking streaks and unlocking achievement trophies.
- **Mock Test Simulator:** Simulates a real 65-question AWS SAA-C03 exam with a 130-minute countdown timer.
- **Bulk Question Import:** Seamlessly parse and bulk load custom dumps from the homepage text area.

---

## Directory Structure

```text
/
├── app.py
├── db.py
├── requirements.txt
├── README.md
├── database/
│   └── quiz.db (Auto-created SQLite database)
├── data/
│   └── default_questions.json (Contains the 41 pre-seeded questions)
├── templates/
│   ├── base.html
│   ├── dashboard.html
│   ├── quiz.html
│   └── stats.html
└── static/
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js
    │   └── sound.js
    ├── sounds/ (For optional static sound overrides)
    └── images/ (For optional static assets)
```

---

## Setup Instructions

### Prerequisites
Make sure Python 3.8+ is installed on your PC.

### Installation
1. Open PowerShell or Command Prompt in this folder.
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

## Run Commands

Start the local development server:
```bash
python app.py
```

Then open your web browser and navigate to:
```text
http://127.0.0.1:8080
```

---

## Sample JSON Import Format

To import new questions, paste a JSON array formatted like below into the **Bulk JSON Import** field on the dashboard:

```json
[
  {
    "id": 204,
    "question_text": "A company wants to run a serverless application that requires a key-value store with sub-millisecond latency. Which database service should they choose?",
    "options": [
      "Amazon DynamoDB with DynamoDB Accelerator (DAX)",
      "Amazon Aurora Serverless",
      "Amazon RDS for PostgreSQL",
      "Amazon DocumentDB"
    ],
    "correct_answer": "A",
    "explanation": "Amazon DynamoDB with DAX provides fully managed, highly available, in-memory cache that delivers sub-millisecond response times.",
    "tags": "DynamoDB,DAX,Database",
    "difficulty": "Easy"
  }
]
```
> [!NOTE]
> The question ID determines which Part the question is automatically assigned to based on the SAA-C03 structure rules.
