const https = require('https');
const url = require('url');
const svmjs = require('svm');

// gcloud beta functions deploy twoSvm --stage-bucket staging.two-svm-no.appspot.com --trigger-http

exports.twoSvm = (req, resp) => {
  const link = url.parse(req.url, true);
  https.get('https:/'+link.path, (newResp) => {
    let data = '';
    newResp.on('data', (chunk) => {
      data += chunk;
    }).on('end', () => {
      const MYDATA = JSON.parse(data);
      if (!MYDATA) {
        resp.statusCode = 500;
        resp.write('500: Failed to get data');
        resp.end();
      } else {
        const svm = new svmjs.SVM();
        svm.train(MYDATA.data, MYDATA.labels, {C: 3, numpasses: 100}); // C is a parameter to SVM
        const funAsJSON = svm.toJSON();
        const result = makeCode(funAsJSON);
        setHeaders(resp, Buffer.byteLength(result,'utf8'));
        resp.write(result);
        resp.end();
      }
    });
  });
}

function setHeaders(resp, bodySize) {
  resp.setHeader('Content-Type', 'application/javascript');
  resp.setHeader('Content-Length', bodySize);
  resp.setHeader('Access-Control-Allow-Origin', '*');
};

function makeCode(funAsJSON) {
  return codeToClient + `

const doIt = function(input) {
  const svm = new svmjs.SVM();
  svm.fromJSON(${JSON.stringify(funAsJSON)});
  return svm.predict(input);
};`;
}

const codeToClient = 
`var svmjs = (function(exports){
  
  var SVM = function(options) {}

  SVM.prototype = {

    marginOne: function(inst) {

      var f = this.b;
      if(this.usew_) {
        for(var j=0;j < this.D;j++) {
          f += inst[j] * this.w[j];
        }
      } else {
        for(var i=0;i < this.N;i++) {
          f += this.alpha[i] * this.labels[i] * this.kernel(inst, this.data[i]);
        }
      }
      return f;
    },
    
    predictOne: function(inst) { 
      return this.marginOne(inst) > 0 ? 1 : -1; 
    },
    
    margins: function(data) {
      var N = data.length;
      var margins = new Array(N);
      for(var i=0;i < N;i++) {
        margins[i] = this.marginOne(data[i]);
      }
      return margins;
    },

    kernelResult: function(i, j) {
      if (this.kernelResults) {
        return this.kernelResults[i][j];
      }
      return this.kernel(this.data[i], this.data[j]);
    },

    predict: function(data) {
      var margs = this.margins(data);
      for(var i=0;i < margs.length;i++) {
        margs[i] = margs[i] > 0 ? 1 : -1;
      }
      return margs;
    },
    getWeights: function() {
      
      var w= new Array(this.D);
      for(var j=0;j < this.D;j++) {
        var s= 0.0;
        for(var i=0;i < this.N;i++) {
          s+= this.alpha[i] * this.labels[i] * this.data[i][j];
        }
        w[j]= s;
      }
      return {w: w, b: this.b};
    },

    toJSON: function() {
      if(this.kernelType === "custom") {
        console.log("Can't save this SVM because it's using custom, unsupported kernel...");
        return {};
      }

      json = {}
      json.N = this.N;
      json.D = this.D;
      json.b = this.b;

      json.kernelType = this.kernelType;
      if(this.kernelType === "linear") { 
        json.w = this.w; 
      }
      if(this.kernelType === "rbf") { 
        json.rbfSigma = this.rbfSigma; 
        json.data = this.data;
        json.labels = this.labels;
        json.alpha = this.alpha;
      }
      return json;
    },
    
    fromJSON: function(json) {
      this.N = json.N;
      this.D = json.D;
      this.b = json.b;

      this.kernelType = json.kernelType;
      if(this.kernelType === "linear") { 
        this.w = json.w; 
        this.usew_ = true; 
        this.kernel = linearKernel; // this shouldn't be necessary
      }
      else if(this.kernelType == "rbf") {
        this.rbfSigma = json.rbfSigma; 
        this.kernel = makeRbfKernel(this.rbfSigma);
        this.data = json.data;
        this.labels = json.labels;
        this.alpha = json.alpha;
      } else {
        console.log("ERROR! unrecognized kernel type." + this.kernelType);
      }
    }
  }

  function makeRbfKernel(sigma) {
    return function(v1, v2) {
      var s=0;
      for(var q=0;q < v1.length;q++) { s += (v1[q] - v2[q])*(v1[q] - v2[q]); } 
      return Math.exp(-s/(2.0*sigma*sigma));
    }
  }
  
  function linearKernel(v1, v2) {
    var s=0; 
    for(var q=0;q < v1.length;q++) { s += v1[q] * v2[q]; } 
    return s;
  }

  function randf(a, b) {
    return Math.random()*(b-a)+a;
  }

  function randi(a, b) {
      return Math.floor(Math.random()*(b-a)+a);
  }

  function zeros(n) {
    var arr= new Array(n);
    for(var i=0;i < n;i++) { arr[i]= 0; }
    return arr;
  }

  exports = exports || {};
  exports.SVM = SVM;
  exports.makeRbfKernel = makeRbfKernel;
  exports.linearKernel = linearKernel;
  return exports;

})(typeof module != 'undefined' && module.exports);`;