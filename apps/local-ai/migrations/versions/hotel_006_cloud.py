"""Explicit additive host-storage schema. Never applied to a live DB on import."""
from alembic import op
import sqlalchemy as sa

revision = 'hotel_006'
down_revision = 'hotel_005'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('kundenz_invitations', sa.Column('role', sa.String(), nullable=False, server_default='TEST_CUSTOMER'))
    op.create_table('cloud_documents',
        sa.Column('tenant', sa.String(), primary_key=True), sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False), sa.Column('data_class', sa.String(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False))
    op.create_table('cloud_versions',
        sa.Column('tenant', sa.String(), primary_key=True), sa.Column('document_id', sa.String(), primary_key=True),
        sa.Column('version', sa.Integer(), primary_key=True), sa.Column('content', sa.Text(), nullable=False),
        sa.Column('sha256', sa.String(), nullable=False), sa.Column('principal', sa.String(), nullable=False),
        sa.Column('created', sa.String(), nullable=False))
    op.create_table('cloud_drafts',
        sa.Column('tenant', sa.String(), primary_key=True), sa.Column('id', sa.String(), primary_key=True),
        sa.Column('principal', sa.String(), nullable=False), sa.Column('expires', sa.Float(), nullable=False),
        sa.Column('payload', sa.Text(), nullable=False))
    op.create_table('cloud_commits',
        sa.Column('tenant', sa.String(), primary_key=True), sa.Column('principal', sa.String(), primary_key=True),
        sa.Column('key', sa.String(), primary_key=True), sa.Column('document_id', sa.String(), nullable=False),
        sa.Column('draft_id', sa.String(), nullable=False), sa.Column('sha256', sa.String(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False))
    op.create_table('cloud_permissions',
        sa.Column('principal', sa.String(), primary_key=True), sa.Column('actions', sa.Text(), nullable=False),
        sa.Column('data_classes', sa.Text(), nullable=False), sa.Column('consent_ref', sa.String(), nullable=False),
        sa.Column('expires', sa.Float(), nullable=False), sa.Column('revoked', sa.Integer(), nullable=False))
    op.create_table('cloud_budgets', sa.Column('tenant', sa.String(), primary_key=True),
                    sa.Column('used', sa.Integer(), nullable=False))


def downgrade():
    for name in ('cloud_budgets', 'cloud_permissions', 'cloud_commits', 'cloud_drafts',
                 'cloud_versions', 'cloud_documents'):
        op.drop_table(name)
    op.drop_column('kundenz_invitations','role')
