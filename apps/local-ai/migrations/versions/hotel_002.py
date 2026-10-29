from alembic import op
import sqlalchemy as sa
revision='hotel_002'
down_revision='hotel_001'
branch_labels=None
depends_on=None
def upgrade():op.add_column('hotel_tickets',sa.Column('photos',sa.Text(),nullable=False,server_default='[]'))
def downgrade():
    with op.batch_alter_table('hotel_tickets') as batch:batch.drop_column('photos')
