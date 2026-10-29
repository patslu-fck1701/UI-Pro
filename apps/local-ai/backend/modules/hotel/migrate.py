"""Versioned additive hotel migration. Existing Core/Business tables are untouched."""
from alembic.config import Config
from alembic import command
from ...db import engine,ROOT
def migrate():
    with engine.begin() as connection:
        config=Config();config.set_main_option('script_location',str(ROOT/'migrations'));config.attributes['connection']=connection
        command.upgrade(config,'head')
