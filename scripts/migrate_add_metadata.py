import sqlite3

conn = sqlite3.connect('data/bookmarks.db')
c = conn.cursor()
cols = [row[1] for row in c.execute('PRAGMA table_info(bookmarks)').fetchall()]
print('existing cols:', cols)
for col, typ in [('author_name','TEXT'), ('author_handle','TEXT'), ('tweet_text','TEXT'), ('media_url','TEXT')]:
    if col not in cols:
        c.execute(f"ALTER TABLE bookmarks ADD COLUMN {col} {typ} DEFAULT ''")
        print(f'Added {col}')
    else:
        print(f'Already exists: {col}')
conn.commit()
conn.close()
print('Done')
