"""Prepared only. Deployment/migration requires separate Owner approval."""
from alembic import op
import sqlalchemy as sa

revision = 'hotel_005'
down_revision = 'hotel_004'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('kundenz_login_rates',
        sa.Column('client_hash', sa.String(), primary_key=True),
        sa.Column('started', sa.Float(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False))
    op.create_table('kundenz_login_flows',
        sa.Column('state_hash', sa.String(), primary_key=True),
        sa.Column('binding_hash', sa.String(), nullable=False),
        sa.Column('nonce', sa.String(), nullable=False),
        sa.Column('verifier', sa.String(), nullable=False),
        sa.Column('expires', sa.Float(), nullable=False),
        sa.Column('client_hash', sa.String(), nullable=False),
        sa.Column('invitation_hash', sa.String(), nullable=False))
    op.create_table('kundenz_grants',
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('issuer', sa.String(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('tenant', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('modules', sa.String(), nullable=False),
        sa.Column('expires', sa.Float(), nullable=False),
        sa.Column('revoked', sa.Integer(), nullable=False),
        sa.UniqueConstraint('issuer', 'subject', name='uq_kundenz_identity'))
    op.create_table('kundenz_invitations',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('token_hash', sa.String(), nullable=False, unique=True),
        sa.Column('recipient', sa.String(), nullable=False),
        sa.Column('tenant', sa.String(), nullable=False, unique=True),
        sa.Column('expires', sa.Float(), nullable=False),
        sa.Column('access_expires', sa.Float(), nullable=False),
        sa.Column('modules', sa.String(), nullable=False),
        sa.Column('revoked', sa.Integer(), nullable=False),
        sa.Column('consumed', sa.Integer(), nullable=False))
    op.create_table('kundenz_sessions',
        sa.Column('token_hash', sa.String(), sa.ForeignKey('sessions.token_hash', ondelete='CASCADE'), primary_key=True),
        sa.Column('issuer', sa.String(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False))


def downgrade():
    op.drop_table('kundenz_invitations')
    op.drop_table('kundenz_sessions')
    op.drop_table('kundenz_grants')
    op.drop_table('kundenz_login_flows')
    op.drop_table('kundenz_login_rates')
