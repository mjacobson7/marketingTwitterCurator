const express = require('express');
const app = express();
const secrets = require('./secrets');
const Twitter = require('twitter');
const json2csv = require('json2csv').parse;
const sgMail = require('@sendgrid/mail');
const cron = require('node-cron');
const port = 6700;

app.listen(port, () => {
    console.log(`Server listening on port: ${port}`)
})

const T = new Twitter({
    consumer_key: secrets.CONSUMER_KEY,
    consumer_secret: secrets.CONSUMER_SECRET,
    access_token_key: secrets.ACCESS_TOKEN_KEY,
    access_token_secret: secrets.ACCESS_TOKEN_SECRET
})

sgMail.setApiKey(secrets.SENDGRID_KEY);

cron.schedule('0 12 * * 1-5', () => {

    const date = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Denver" }));
    const yesterday = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate() - 1}`;
    let jsonTab = [];
    let csv = null;
    const searchTerms = ['Employee Recognition', 'Employee Engagement', 'Recognition', 'Employee', 'Amazon Business', 'Human Resources', 'Silicon Slopes', 'Employee Rewards']
    

    Promise.all(searchTerms.map(async term => {
        let data = await T.get('search/tweets', { q: `"${term}" -filter:retweets -filter:replies -filter:possibly_sensitive`, lang: `en`, result_type: 'popular', count: 100, since: yesterday })
        try {
            data.statuses.map(tweet => {
                const json = {
                    Text: tweet.text,
                    Date: new Date(tweet.created_at).toDateString().split(' ').slice(1).join(' '),
                    Likes: tweet.favorite_count,
                    Retweets: tweet.retweet_count,
                    Link: `https://twitter.com/tweet/status/${tweet.id_str}`
                }
                jsonTab.push(json);
            })
        } catch (err) {
            console.log(err)
        }
    }))
        .then(() => {
            csv = json2csv(jsonTab, { fields: ['Text', 'Date', 'Likes', 'Retweets', 'Link'] })
            sgMail.send({
                to: secrets.RECIPIENTS,
                from: secrets.FROM_EMAIL,
                subject: 'Daily Twitter Curator',
                html: `<strong>***This is an automated message***</strong>`,
                attachments: [{ content: Buffer.from(csv).toString('base64'), filename: 'twitterFeed.csv' }]
            }).catch(err => console.log(err))
        })

}, { scheduled: true, timezone: 'America/Denver' })