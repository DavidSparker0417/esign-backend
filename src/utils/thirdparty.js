const axios = require("axios");

async function getGoogleProfile(token) {
  const apiUrl = "https://www.googleapis.com/oauth2/v3/userinfo?access_token=" + token;
  const profile = (await axios.get(apiUrl)).data;
  return {
    email: profile.email,
    name: profile.name,
    photo: profile.picture
  };
}

const twitterRelayServer = "https://pensive-snyder-a1edac.netlify.app/.netlify/functions/index/";
// step 1
function twitterGetOAuthToken() {
  return axios.post
  (twitterRelayServer + "twitter/oauth/request_token")
  .then((resp) => {
    const {oauth_token} = resp.data;
    oauth_token_secret = "not implemented yet";
    console.log("[DAVID] twitterGetOAuthToken :: oauth_token = ", oauth_token);
    return {oauth_token, oauth_token_secret};
  })
  .catch((e) => {
    console.log("[DAVID] twitterGetOAuthToken :: err = ", e.message);
    return undefined;
  });
}

// step 3
async function twitterGetAccessToken(oauth_token, oauth_token_secret, oauth_verifier) {
  const oauth_access_token = "oauth_access_token:preparing";
  const oauth_access_token_secret = "oauth_access_token:preparing";
  return {oauth_access_token, oauth_access_token_secret};
}

module.exports = {
  getGoogleProfile,
  twitterGetOAuthToken,
  twitterGetAccessToken,
};