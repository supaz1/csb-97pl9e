//DB reference
CLIENT_ID='llxrl7FxoCHZcY04jJrGeyOhz'
CLIENT_SECRET='VbEYFFtOkPm85xrdBK571Q68aAijWEhodE9mRfsMfk9tRoK1US'
ORGANIZATION='-'
API_SECRET='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'

const functions = require("firebase-functions")
const admin = require('firebase-admin')
admin.initializeApp()

// // const dbRef = admin.firestore().doc('tokens/env')
// const dbRef = admin.firestore().doc('.env.local')

//twitter api init
const TwitterApi = require('twitter-api-v2').default;
const twitterClient = new TwitterApi({
  clientId: 'CLIENT_ID',
  clientSecret: 'CLIENT_SECRET',
})

const callbackURL = 'http://localhost:3000/callback';
// 'http://localhost:5000/gpt3-twitter-bot/us-central1/callback'


//openai api init
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
  organization: 'ORGANIZATION',
  apiKey: 'API_SECRET',
});
const openai = new OpenAIApi(configuration);

// auth url
exports.auth = functions.https.onRequest((req, res) => {
    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
      );
      // store verifier
      await dbRef.set({ codeVerifier, state })
    
      res.redirect(url)
})

exports.callback = functions.https.onRequest((req, res) => {
    const { state, code } = req.query

  const dbSnapshot = await dbRef.get()
  const { codeVerifier, state: storedState } = dbSnapshot.data()

  if (state !== storedState) {
    return res.status(400).send('Stored tokens do not match!')
  }

  const {
    client: loggedClient,
    accessToken,
    refreshToken,
  } = await twitterClient.loginWithOAuth2({
    code,
    codeVerifier,
    redirectUri: callbackURL,
  });

  await dbRef.set({ accessToken, refreshToken })

  const { data } = await loggedClient.v2.me()

  res.send(data)
})


//post tweets
exports.tweet = functions.https.onRequest((req, res) => {
    const { refreshToken } = (await dbRef.get()).data()

  const {
    client: refreshedClient,
    accessToken,
    refreshToken: newRefreshToken,
  } = await twitterClient.refreshOAuth2Token(refreshToken)

  await dbRef.set({ accessToken, refreshToken: newRefreshToken })

  const nextTweet = await openai.createCompletion('text-davinci-001', {
    prompt: 'random tweet for #techtwitter',
    max_tokens: 64,
  })

  const { data } = await refreshedClient.v2.tweet(
    nextTweet.data.choices[0].text
  )

  res.send(data)
})
 