var Q = require("q");
var rest = require("restler");
var FS = require('fs');
var mediaHttp = require("./mediaHttp.js");
var AuthClient = require("./AuthClient.js");


var WIX_MEDIA_UPLOAD_URL_PATH = '/files/upload/url';

function UploadedMedia(data) {
	Object.defineProperty(this, "fileId", { get: function () { return data.file_url; } });
	Object.defineProperty(this, "fileUrl", { get: function () { return data.file_url; } });
	Object.defineProperty(this, "fileSize", { get: function () { return data.file_size; } });
	Object.defineProperty(this, "fileName", { get: function () { return data.file_name; } });
	Object.defineProperty(this, "originalFileName", { get: function () { return data.original_file_name; } });
	Object.defineProperty(this, "width", { get: function () { return data.width; } });
	Object.defineProperty(this, "height", { get: function () { return data.height; } });
}

function UploadClient(apiKey, secretKey) {
	AuthClient.call(this, apiKey, secretKey);
}

UploadClient.prototype = AuthClient.prototype;

UploadClient.prototype.getUploadUrl = function() {
	var deferred = Q.defer();
	var that = this;
	this.getAuthToken().then(function(authToken) {
		var options = {
			headers : that.getAuthHeaders(authToken),
			path : WIX_MEDIA_UPLOAD_URL_PATH,
			host : mediaHttp.CLOUD_URL
		};
		mediaHttp.request(options).then(function(data) {
			deferred.resolve(data.data.upload_url);
		}, function(error) {
			deferred.reject(error);
		});
	}, function(error) {
		deferred.reject(error);
	});
	return deferred.promise;
};

UploadClient.prototype.upload = function (path, success, failure) {
	var deferred = Q.defer();
	var that = this;
	this.getUploadUrl().then(function(uploadUrl) {
		Q.nfcall(FS.stat, path).then(function(stats) {
			rest.post(uploadUrl, {
				multipart: true,
				headers : that.getAuthHeaders(that.authToken),
				data : {
					"media_type" : "picture",
					"file" : rest.file(path, null, stats.size)
				}

			}).on('complete', function(data) {
				var retVal = new UploadedMedia(data[0]);
				if(typeof success === "function") {
					success(retVal);
				}
				deferred.resolve(retVal);
			}).on('error', function(data) {
				deferred.reject(data);
			});
		});

	}, function(error) {
		if(typeof failure === "function") {
			failure(error);
		}
		deferred.reject(error);
	});
	if(typeof success === "function") {
		var ref = setInterval(function() {
			if(deferred.promise.isFulfilled() || deferred.promise.isRejected()) {
				clearInterval(ref);
				return;
			}
		}, 100);
	} else {
		return deferred.promise;
	}
};


module.exports = {
	client : function(apiKey, secretKey) {
		var c = new UploadClient(apiKey, secretKey);
		return {
			uploadFromFile : function(path, success, failure) {
				return c.upload(path, success, failure);
			}
		};
	}
};