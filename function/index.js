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
      resp.setHeader('Content-Type', type);
      resp.setHeader('Content-Length', size);
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