class BulkTopicInTrashError(Exception):
    def __init__(self, name: str) -> None:
        self.name = name


class BulkSlugConflictError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail


class BulkInvalidTopicNameError(Exception):
    def __init__(self, name: str) -> None:
        self.name = name
