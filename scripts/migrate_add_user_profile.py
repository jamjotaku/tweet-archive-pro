import sqlite3

def run():
    print('Starting migration for user profile fields...')
    conn = sqlite3.connect('data/bookmarks.db')
    c = conn.cursor()
    
    # Check existing columns in users table
    cols = [row[1] for row in c.execute('PRAGMA table_info(users)').fetchall()]
    print('Existing users columns:', cols)
    
    # Define columns to add
    new_columns = [
        ('display_name', 'TEXT'),
        ('bio', 'TEXT')
    ]
    
    for col, typ in new_columns:
        if col not in cols:
            c.execute(f"ALTER TABLE users ADD COLUMN {col} {typ} DEFAULT ''")
            print(f'Added {col}')
        else:
            print(f'Already exists: {col}')
            
    conn.commit()
    conn.close()
    print('Migration completed successfully.')

if __name__ == "__main__":
    run()
