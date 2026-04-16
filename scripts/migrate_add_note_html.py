import sqlite3
import markdown
import bleach

def setup():
    conn = sqlite3.connect('data/bookmarks.db')
    c = conn.cursor()
    
    cols = [row[1] for row in c.execute('PRAGMA table_info(bookmarks)').fetchall()]
    print('Existing bookmarks columns:', cols)
    
    if 'note_html' not in cols:
        c.execute("ALTER TABLE bookmarks ADD COLUMN note_html TEXT DEFAULT ''")
        print('Added note_html column.')
    else:
        print('note_html column already exists.')
        
    print('Updating existing notes to HTML...')
    c.execute("SELECT id, note FROM bookmarks WHERE note != '' AND (note_html = '' OR note_html IS NULL)")
    rows = c.fetchall()
    
    for row_id, note in rows:
        if note:
            # Markdown parse
            html_content = markdown.markdown(note, extensions=['fenced_code', 'tables', 'nl2br'])
            # Sanitize
            allowed_tags = bleach.sanitizer.ALLOWED_TAGS | {
                'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr', 'img', 'span', 'div'
            }
            allowed_attrs = bleach.sanitizer.ALLOWED_ATTRIBUTES.copy()
            allowed_attrs['*'] = ['class']
            allowed_attrs['img'] = ['src', 'alt', 'title']
            
            clean_html = bleach.clean(html_content, tags=allowed_tags, attributes=allowed_attrs)
            
            c.execute("UPDATE bookmarks SET note_html = ? WHERE id = ?", (clean_html, row_id))
            
    conn.commit()
    conn.close()
    print(f'Migrated {len(rows)} records successfully.')

if __name__ == '__main__':
    setup()
