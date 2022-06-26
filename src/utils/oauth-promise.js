//convert oauth methods to promises so we can use async/await syntax
//and keep our code sexier

const twitterOAuth = (oauthCallback) => {
  
  // oatuh 1.0
  const _oauth = new (require('oauth').OAuth)(
      'https://api.twitter.com/oauth/request_token',
      'https://api.twitter.com/oauth/access_token',
      "BrDN3VBrHOAq83PeSxIq5lIbf", // consumer key
      "H4IvckKFpUapoR6zdSIZP6MK7vV5PtszHuo2JhT03Tn1tPLf7F", // consumer secret
      '1.0',
      oauthCallback,
      'HMAC-SHA1'
  );
  // // oatuh 2.0
  // const _oauth = new (require('oauth').OAuth2)(
  //   "BrDN3VBrHOAq83PeSxIq5lIbf", // consumer key
  //   "H4IvckKFpUapoR6zdSIZP6MK7vV5PtszHuo2JhT03Tn1tPLf7F", // consumer secret
  //   'https://api.twitter.com/', null, 'oauth2/token', null
  // );

  const oauth ={
    getOAuthRequestToken: () => { 
      return new Promise((resolve, reject) => {
        _oauth.getOAuthRequestToken((error, oauth_token, oauth_token_secret, results) => {
          if(error) {
            reject(error);  
          } else {
            resolve({oauth_token, oauth_token_secret, results});  
          }
        });
      });
    },
    
    getOAuthAccessToken: (oauth_token, oauth_token_secret, oauth_verifier) => { 
      return new Promise((resolve, reject) => {
        _oauth.getOAuthAccessToken(oauth_token, oauth_token_secret, oauth_verifier, (error, oauth_access_token, oauth_access_token_secret, results) => {
          if(error) {
            reject(error);  
          } else {
            resolve({oauth_access_token, oauth_access_token_secret, results});  
          }
        });
      });
    },
    
    getProtectedResource: (url, method, oauth_access_token, oauth_access_token_secret) => {
       return new Promise((resolve, reject) => {
        _oauth.getProtectedResource(url, method, oauth_access_token, oauth_access_token_secret,  (error, data, response) => {
          if(error) {
            reject(error);  
          } else {
            resolve({data, response});  
          }
        });
      });   
    }
    
  };
  
  return oauth;
}

module.exports = {
  twitterOAuth
};