class DuplicateWordInTopicError(Exception):
    def __init__(self, term: str) -> None:
        self.term = term
        super().__init__(f"Word '{term}' already exists in one of the selected topics")
