"""Durable monthly character and per-principal minute reservations; no audio/text."""
from alembic import op
import sqlalchemy as sa
revision='hotel_007'
down_revision='hotel_006'
branch_labels=None
depends_on=None
def upgrade():
    op.create_table('cloud_voice_budgets',sa.Column('scope',sa.String(),primary_key=True),
        sa.Column('period',sa.String(),primary_key=True),sa.Column('used',sa.Integer(),nullable=False))
def downgrade():op.drop_table('cloud_voice_budgets')
