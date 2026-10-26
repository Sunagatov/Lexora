class DuplicateWordInTopicError(Exception):
    def __init__(self, term: str) -> None:
        self.term = term
        super().__init__(f"Word '{term}' already exists in the database")


class WordRequiresTopicError(Exception):
    def __init__(self, word_id: int) -> None:
        super().__init__(f"Word {word_id} must belong to at least one active topic")
