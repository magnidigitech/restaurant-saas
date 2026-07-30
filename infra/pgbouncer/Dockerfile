FROM ghcr.io/cloudnative-pg/pgbouncer:1.25.2

COPY --chown=10001:0 infra/pgbouncer/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
COPY --chown=10001:0 infra/pgbouncer/userlist.txt /etc/pgbouncer/userlist.txt
