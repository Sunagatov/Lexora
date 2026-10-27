import re
import unicodedata


def normalize_term(term: str) -> str:
    """Normalize a vocabulary term for duplicate detection: NFKC, collapse whitespace, lowercase."""
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', term)).strip().lower()


def slugify(value: str, max_len: int = 200) -> str:
    """Convert a string to a URL-safe slug."""
    normalized = unicodedata.normalize('NFKD', value)
    letters = ''.join(char for char in normalized if not unicodedata.combining(char))
    slug = re.sub(r'[\W_]+', '-', letters, flags=re.UNICODE).strip('-').lower()
    return slug[:max_len]
