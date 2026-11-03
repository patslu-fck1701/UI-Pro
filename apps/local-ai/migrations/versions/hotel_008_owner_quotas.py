"""Private per-Owner dated snapshots; no provider credentials or raw exports."""
from alembic import op
import sqlalchemy as sa
revision='hotel_008'
down_revision='hotel_007'
branch_labels=None
depends_on=None
def upgrade():
    op.create_table('owner_quota_snapshots',sa.Column('owner_id',sa.String(),primary_key=True),
        sa.Column('provider',sa.String(),primary_key=True),sa.Column('metric',sa.String(),primary_key=True),
        sa.Column('version',sa.Integer(),nullable=False),sa.Column('payload',sa.Text(),nullable=False))
    op.create_table('owner_quota_imports',sa.Column('owner_id',sa.String(),primary_key=True),
        sa.Column('key',sa.String(),primary_key=True),sa.Column('digest',sa.String(),nullable=False),sa.Column('result',sa.Text(),nullable=False))
def downgrade():
    op.drop_table('owner_quota_imports');op.drop_table('owner_quota_snapshots')
