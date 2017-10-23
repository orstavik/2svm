const https = require('https');
const url = require('url');
const jsMinify = require('uglify-es').minify;
const htmlMinify = require('html-minifier').minify;
const CleanCSS = require('clean-css');

// gcloud beta functions deploy twoMin --stage-bucket staging.two-min-no.appspot.com --trigger-http

exports.twoMin = (req, resp) => {
  if (req.url === '/') {
    resp.end();
  }
  const link = url.parse(req.url, true);
  const ext = link.pathname.split('.').pop();
  const type = TYPE[ext];
  https.get('https:/'+link.path, (newResp) => {
    let data = '';
    newResp.on('data', (chunk) => {
      data += chunk;
    }).on('end', () => {
      const min = minify(data, ext);
      const size = Buffer.byteLength(min,'utf8');
      setHeaders(resp, ext, size, req.headers['referer']);
      if (!min) {
        resp.statusCode = 500;
        resp.write('500: Failed to minify');
        resp.end();
      } else {
        resp.write(min);
        resp.end();
      }
    });
  });
}

function minify(body, ext) {
  let res;
  switch (ext) {
    case 'js':
      res = jsMinify(body);
      return res.code;
    case 'css':
      res = new CleanCSS().minify(body);
      return res.styles;
    case 'html':
      res = htmlMinify(body, {
        removeAttributeQuotes: true,
        collapseWhitespace: true,
        removeComments: true,
        minifyJS(code) {
          res = jsMinify(code);
          if (res.error) {
            console.log(res.error.stack);
            return code;
          }
          return res.code;
        }
      });
      return res;
  }
}

const TYPE = {
  js: 'application/javascript',
  css: 'text/css',
  html: 'text/html',
  json: 'application/json',
  map: 'application/octet-stream'
}

function setHeaders(resp, extention, bodySize /*, refererUrl */) {
  const type = TYPE[extention] || '';
  // TODO: no way of setting special CORS policy
  // How to setting Control-Access-Allow-Origin:
  // 1. add ?CORS=<host> to the 2cdn.no link. 
  // 2. 2cdn.no/ will check a list of accepted CORS hosts if the host is whitelisted or blacklisted.
  // 3a. 2cdn.no/ will then add <host> to the Access-Control-Allow-Origin if it is whitelisted.
  // 3b. 2cdn.no/ will add only "example.com" if it is not whitelisted.
  // 4. many whitelisted hosts can be added to this list by default, such as codepen.io, jsfiddle.com, etc.
  resp.setHeader('Content-Type', type);
  resp.setHeader('Content-Length', bodySize);
  resp.setHeader('Access-Control-Allow-Origin', '*');
};