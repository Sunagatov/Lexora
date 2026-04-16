from unittest.mock import ANY, MagicMock, call

from app.features.trash import service as trash_service


def test_purge_trash_purges_only_old_items_when_not_forced(monkeypatch, make_topic) -> None:
    db = MagicMock()
    topics_to_purge = [
        make_topic(id=1, slug="travel"),
        make_topic(id=2, slug="work"),
    ]
    db.scalars.return_value.all.return_value = topics_to_purge

    soft_delete = MagicMock()
    monkeypatch.setattr(trash_service, "soft_delete_exclusive_words", soft_delete)
    monkeypatch.setattr(trash_service.settings, "trash_retention_days", 30)

    trash_service.purge_trash(db, force=False)

    assert soft_delete.call_count == 2
    soft_delete.assert_has_calls([call(topics_to_purge[0], ANY), call(topics_to_purge[1], ANY)])
    assert db.execute.call_count == 2
    db.commit.assert_called_once()


def test_purge_trash_purges_all_deleted_items_when_forced(monkeypatch, make_topic) -> None:
    db = MagicMock()
    topics_to_purge = [make_topic(id=10, slug="travel")]
    db.scalars.return_value.all.return_value = topics_to_purge

    soft_delete = MagicMock()
    monkeypatch.setattr(trash_service, "soft_delete_exclusive_words", soft_delete)

    trash_service.purge_trash(db, force=True)

    soft_delete.assert_called_once_with(topics_to_purge[0], ANY)
    assert db.execute.call_count == 2
    db.commit.assert_called_once()