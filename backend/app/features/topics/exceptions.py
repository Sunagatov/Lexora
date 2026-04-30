class TopicSlugConflictError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class InvalidTopicNameError(Exception):
    def __init__(self, name: str) -> None:
        self.name = name
        super().__init__(f"Cannot generate a valid slug from name '{name}'")


class InvalidTopicParentError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class TopicNameConflictError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class MissingTopicsError(Exception):
    def __init__(self, ids: list[int]) -> None:
        self.ids = ids
        super().__init__(f"Topics not found: {ids}")


class TopicHasActiveChildrenError(Exception):
    def __init__(self, child_names: list[str]) -> None:
        self.child_names = child_names
        self.detail = "Cannot delete topic while active subtopics exist: " + ", ".join(child_names)
        super().__init__(self.detail)
