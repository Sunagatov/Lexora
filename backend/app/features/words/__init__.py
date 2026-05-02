import warnings

# Pydantic warns that "register" shadows BaseModel.register(). The field name matches
# the DB column and API contract — renaming it would be more disruptive than the warning.
warnings.filterwarnings("ignore", message=r'Field name "register" in .* shadows an attribute in parent')
