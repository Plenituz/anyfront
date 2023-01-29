FROM nginx:alpine

COPY __barbe_tmp/nginx.conf /etc/nginx/conf.d/default.conf
RUN cat /etc/nginx/conf.d/default.conf

COPY . /etc/nginx/html/
RUN rm -rf /etc/nginx/html/__barbe_tmp

ENV PORT 8080
ENV HOST 0.0.0.0
EXPOSE 8080

RUN ls -la /etc/nginx/html/
CMD sh -c "nginx -g 'daemon off;'"