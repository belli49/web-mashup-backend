require("dotenv").config();
const express = require("express");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
app.use(express.json());

const cors = require('cors');
app.use(cors({
    origin: 'http://localhost:3000'
}));

const openai_configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openai_configuration);

var axios = require('axios');



const port = process.env.PORT || 5000;


// REQUESTS

// chatGPT recommendations
app.post("/ask", async (req, res) => {
  const request_info = req.body.prompt;
  try {
    if (request_info.place == null) {
      throw new Error("Uh oh, no prompt was provided");
    }

    let prompt = `Make a plan for a 1 day ${(request_info.type == '') ? 'date' : request_info.type} in ${request_info.place}.`;
    prompt += `\nDisplay the plan in a list, with each entry in the same line (with no newline characters or carriage returns), in the following format:\n"(entry number)#(schedule name)#(start time)#(end time)#(Description of what to do there)#(name of place);"\nexample: "1#Visit Zuihoden Mausoleum#9:00am#10:00am#Visit the final resting place of Date Masamune, one of Japan's most powerful feudal lords, and admire the intricate architecture and beautiful surroundings.#Zuihoden Mausoleum;`;

    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{"role": "system", "content": prompt}],
    });

    const completion = response.data.choices[0].message;

    let newPlacesList = completion.content
      .replace(/(\r\n|\n|\r)/gm, "")
      .split(';')
      .map((placeEntry) => {
        let info = placeEntry.split('#');

        return {
          schedule_id: info[0],
          what_to_do: info[1],
          startTime: info[2],
          endTime: info[3],
          description: info[4],
          schedule_name: info[5],

          googlemap_id: -1,
          schedule_image: -1,
        };
      });
    
    if (newPlacesList[newPlacesList.length - 1].schedule_id == '') newPlacesList.pop();


    const promises = [];
    for (let i = 0; i < newPlacesList.length; i++) {
      promises.push(new Promise((resolve, reject) => {
        var places_config = {
          method: 'get',
          url: `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${newPlacesList[i].schedule_name.replace(' ', '%20')}&inputtype=textquery&fields=formatted_address%2Cname%2Crating%2Copening_hours%2Cphotos%2Cplace_id%2Cgeometry&key=${process.env.GOOGLE_API_KEY}`,
          headers: { }
        };

        axios(places_config)
          .then((response) => {
            console.log(JSON.stringify(response.data));
            newPlacesList[i].googlemaps_info = response.data;
            newPlacesList[i].googlemap_id = 0;

            return newPlacesList.googlemap_id;
          })
          .then((res) => resolve(i))
          .catch(function (error) {
            console.log(error);
            reject("error");
          });
      }));
    }

    const places_info = await Promise.all(promises);

    return res.status(200).json({
      success: true,
      message: completion,
      newPlacesList: newPlacesList,
    });
  } catch (error) {
    console.log(error.message);
  }
});



app.listen(port, () => console.log(`Server is running on port ${port}!!`));
