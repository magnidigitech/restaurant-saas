FROM ghcr.io/cloudnative-pg/pgbouncer:1.25.2

# Copy configuration templates into the image
COPY infra/pgbouncer/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
COPY infra/pgbouncer/userlist.txt /etc/pgbouncer/userlist.txt
