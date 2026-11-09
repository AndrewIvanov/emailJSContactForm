FROM nginx:alpine

# Конфигурация и сайт входят в образ: его можно запустить без bind mount.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/

EXPOSE 80
