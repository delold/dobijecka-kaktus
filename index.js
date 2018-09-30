const fetch = require('node-fetch')
const cheerio = require('cheerio')
const AWS = require('aws-sdk')

const ddb = new AWS.DynamoDB.DocumentClient()
const slackEndpoint = process.env.SLACK_ENDPOINT
const dynamoTable = process.env.DYNAMO_TABLE_NAME
const dynamoKey = 'CURRENT'

const putContent = (content) => new Promise((resolve, reject) => {
  ddb.put({
    TableName: dynamoTable,
    Item: { data: dynamoKey, content }
  }, (err, data) => err ? reject(err) : resolve(data))
})

const getContent = async () => {
  try {
    const item = await new Promise((resolve, reject) => {
      ddb.get({
        TableName: dynamoTable,
        Key: { data: dynamoKey }
      }, (err, data) => err ? reject(err) : resolve(data))
    })

    if (item && item.Item && item.Item.content) return item.Item.content
  } catch (err) {
    // empty
  }
  return ''
}


const check = async () => {
  const res = await fetch('https://www.mujkaktus.cz/chces-pridat')
  const $ = cheerio.load(await res.text())
  const element = $('div.wrapper > h2.uppercase + h3.uppercase.text-drawn')

  if (!element || !element.text()) throw Error('Heading not found')
  return element.text().trim()
}

exports.handler = async () => {
  try {
    const text = await check()
    const oldText = await getContent()

    console.log(text, oldText)
    if (oldText.toUpperCase() !== text.toUpperCase()) {
      await putContent(text)
      await fetch(slackEndpoint, {
        method: 'POST',
        body: JSON.stringify({
          attachments: [{
            text,
            title: "Dobíječka je tady <!channel>",
            actions: [
              {
                type: "button",
                text: "Další informace",
                "url": "https://www.mujkaktus.cz/chces-pridat"
              },
              {
                type: "button",
                text: "Dobít online",
                style: "primary",
                url: "https://www.mujkaktus.cz/dobit-kartou"
              }
            ]
          }]
        })
      })
    }
  } catch (err) {
    await fetch(slackEndpoint, {
      method: 'POST',
      body: JSON.stringify({
        attachments: [{
          title: "Nastala chyba při vyhodnocování",
          text: err.toString()
        }]
      })
    })
  }
}