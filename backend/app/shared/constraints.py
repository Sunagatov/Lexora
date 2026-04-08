# DB column length constraints — changing these requires a migration.
# Defined once here and referenced in both ORM models and Pydantic schemas.

TOPIC_NAME_MAX_LEN  = 200
TOPIC_SLUG_MAX_LEN  = 200

WORD_TERM_MAX_LEN   = 255
WORD_VERB_FORM_MAX_LEN = 255   # past_simple, past_participle
WORD_POS_MAX_LEN    = 50       # part_of_speech
WORD_COUNT_MAX_LEN  = 50       # countability

KNOWLEDGE_LEVEL_MIN = 1
KNOWLEDGE_LEVEL_MAX = 5

BULK_WORDS_MAX      = 500      # max words per bulk import request
