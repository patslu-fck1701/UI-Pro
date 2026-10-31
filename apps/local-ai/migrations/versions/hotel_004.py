from alembic import op
import sqlalchemy as sa

revision='hotel_004'
down_revision='platform_003'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('hotel_ai_usage',
        sa.Column('actor',sa.String(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('provider',sa.String(),nullable=False),
        sa.Column('model',sa.String(),nullable=False),
        sa.Column('state',sa.String(),nullable=False),
        sa.Column('input_tokens',sa.Integer(),nullable=False),
        sa.Column('output_tokens',sa.Integer(),nullable=False),
        sa.Column('reserved_microusd',sa.Integer(),nullable=False),
        sa.Column('actual_microusd',sa.Integer(),nullable=False),
        sa.Column('id',sa.String(),primary_key=True,nullable=False),
        sa.Column('tenant',sa.String(),sa.ForeignKey('hotel_hotels.tenant'),nullable=False),
        sa.Column('created',sa.String(),nullable=False),
        sa.Column('revision',sa.Integer(),nullable=False),
    )
    op.create_index('ix_hotel_ai_usage_tenant','hotel_ai_usage',['tenant'])

def downgrade():
    op.drop_table('hotel_ai_usage')
