import markdown
import bleach
import sys
import os

# Add the app directory to sys.path to import crud
sys.path.append(os.getcwd())

from app.crud import parse_markdown

test_text = """
# Test Header
- Item 1
- Item 2

`print('hello')`

```python
def hello():
    print("world")
```
"""

html = parse_markdown(test_text)
print("--- HTML OUTPUT ---")
print(html)
print("--- END ---")
