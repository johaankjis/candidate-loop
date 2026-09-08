import pytest

from candidateloop.repository import repository


@pytest.fixture(autouse=True)
def reset_repository():
    repository.reset()
    yield
    repository.reset()
