/**
 * Populate questions with proper question text
 */

import { config } from 'dotenv';
config();

const questionsMap = {
  'bb9b18f9-d429-4680-9830-a0c1ac72236e': 'What is the fastest land animal?',
  '6281c8a8-6eb3-48b4-b382-e6509cba3c7a': 'What is the capital of Germany?',
  '616a7f8b-339a-45ac-a180-fd7e1c333725': 'What is the boiling point of water in Celsius?',
  'aec19488-0301-4af5-bf26-951d9e33d173': 'Who was the first President of the United States?',
  '4da6da18-fe5b-4fc9-8f13-f8d17da8c020': 'Which film franchise features Luke Skywalker?',
  '7efdd630-9704-4987-bf7c-10f7366e800b': 'In American football, how many players are on the field per team?',
  '052855ae-b8cf-4cfd-9e03-9fb6952d3a93': 'Who wrote "A Tale of Two Cities"?',
  'c8f23079-767f-4cee-aa80-5a1a77519f4a': 'What is 12 × 8?',
  'f344148c-a5a2-452c-a5bc-0a007a36a448': 'Who is known as the "King of Pop"?',
  '7e3e7bc8-af58-4df2-96d2-0645e2532b4a': 'Which continent is the largest by population?',
  '306822de-1b9a-4e52-9c65-b84a6b8e281f': 'Which bird lays the most eggs?',
  '68923728-e2e3-4734-b304-451e15806039': 'Humans have how many ribs?',
  'e477f834-8f7f-470a-ad51-cf41957b0ef4': 'In what year did World War II end?',
  '2737442f-f380-47a0-be32-8c502c4c1d4c': 'Who was the lead actor in "Titanic" (1997)?',
  'b26d2125-4550-442e-a83d-79daac4c1872': 'What is 7 + 5?',
  '3076b287-4954-4e27-bd6a-ad9678b1afe4': 'In tennis, what is a score of 0 points called?',
  '1512a50c-5b82-4c2e-924a-0457050959ae': 'Who wrote "1984"?',
  '4705c440-b6da-4b16-834e-87ec51aea971': 'Which country is the most populous in the world?',
  'c84f4a68-58f2-434d-84c6-913e36e1a6f2': 'Which is the fastest land animal?',
  '4981ac29-b70a-40e1-9a7a-875e8580d11d': 'What is H2O commonly known as?',
  'e4010b00-1160-455e-99c8-2a24150adee2': 'In which Tom Hanks film does he play a castaway?',
  'e2ba0322-a0ab-4b88-af48-80c9213ec0fe': 'Who discovered America in 1492?',
  'b7476320-f3c7-446a-9c45-bea87d532f84': 'Which is one of the most famous rock bands of all time?',
  'af508a6a-dd99-4016-b683-d87f57f7a3d5': 'The sum of angles in a triangle is?',
  '8f9505c9-0621-4498-b617-6884045d10e3': 'How many World Cups has Germany won?',
  'a6f3d914-9fa4-4cc5-b3d9-707dc79d5fbb': 'Who wrote "Pride and Prejudice"?',
  'ed25394f-a572-4393-8398-a61ab83e8991': 'Which is the longest river in the world?',
  'ac342218-699e-4833-bbc9-88a02856bae9': 'What is the most abundant gas in Earth\'s atmosphere?',
  'c5492250-58f6-406a-9d3e-5decb02f749e': 'Which film is based on J.R.R. Tolkien\'s novel?',
  '082e4993-77b1-4e33-b3df-b92070c30668': 'How many legs does an insect have?',
  '310d231e-adcd-4b86-a753-7ed6bde2b68f': 'Who is known as the "Queen of Pop"?',
  'bd45b570-eb3b-4a75-813b-3359f77f3bdb': 'Which empire is known for the Great Wall?',
  '40f9c7d1-efc3-4b10-a2a5-8a223f8eeaff': 'Which country is the smallest in the world?',
  '9f0fce89-b774-4281-9049-7027d1dd2d79': 'What is 15 × 15 + 4?',
  'f746079f-b178-486c-8322-d077a40b3836': 'Which is the only mammal that lays eggs?',
  '6ba2e6dc-ac31-405d-bc6e-db9940e1a5a0': 'Who played Tony Stark in the Marvel films?',
  '219f9bcc-ae03-48c6-813b-9239b78fcd97': 'How many balls are used in American football?',
  'f4bb061c-7f72-40f1-bca0-d5f1b3476ef6': 'What is the chemical symbol for Gold?',
  '0fbbb8c1-d79d-43ed-b523-03481dd4e4e8': 'Who wrote "The Catcher in the Rye"?',
  '678cdfae-24fe-442b-8376-583fd2321eef': 'Which mountain range is the longest in the world?',
  '7622dbf1-2a7c-41b0-8b9d-4dc0c8d6086a': 'What is the largest land animal?',
  '8622d8c2-4769-4b83-b2d6-68d5d11c82f5': 'Who directed "Avatar"?',
  'e335074b-e1e4-4327-a86b-62ae93c99239': 'Which band released "Pink Floyd\'s greatest hits"?',
  '332f9184-cfb0-4f98-8fbe-0ae7484c02dd': 'Who was the first woman to win a Nobel Prize?',
  '4e7fe60c-2a76-4f31-a8d8-9b79bf31162d': 'Which planet is known for its rings?',
  '7758b72a-0f6f-4c50-a3ae-6adb34aa21b1': 'Which country has won the most FIFA World Cups?',
  '287442f1-49d0-487e-b7c9-b2c0a284ca67': 'What is 2 + 3 × 2?',
  '120ef168-6638-40b4-9a84-2afb67b73aa0': 'What is a group of lions called?',
  '319d203d-ece3-4db5-a851-90e7fe5ff000': 'Which is the largest ocean on Earth?',
  '5048534a-7766-4478-922f-43ba218af369': 'Who wrote "Moby Dick"?',
  '1ab0aa84-9630-4e88-aa95-34321403d4d8': 'Which is the fastest land animal in Africa?',
  'e8cf7b4d-476a-4297-ae45-ccbb945dd988': 'What is the capital of Spain?',
  'd27f96fa-5134-4684-bd0e-3cb3a5533b3b': 'What is the freezing point of water in Celsius?',
  '7ac139a6-188f-4923-b9f2-52847241c820': 'Who was the first President of USA?',
  'cfc6b0dd-0884-4106-a456-3eb185a7b1e2': 'Which space opera franchise started in 1977?',
  'd593ce45-fdc5-4b96-86a8-24d1cde31826': 'How many players are on a basketball court per team?',
  '32f1363c-1b28-4f1a-8bf9-25b58b17f080': 'Who wrote "Great Expectations"?',
  '3644e75f-1cca-4944-a612-64817c108a35': 'What is 8 × 12?',
  '0e8fae50-9838-406f-90d3-ef1567b75f5f': 'Who is the "King of Pop"?',
  '89155b9c-4f6f-416d-8b63-ff748fe146d4': 'Which continent has the most countries?',
  'c6298b35-3587-40f0-a64b-1f54a32b46a3': 'What is an unkindness a group of?',
  '1808cb3b-03cd-471c-80fd-e7b190ea69a5': 'Venus is often called what?',
  'd94b6568-3b88-45b1-9c03-14fad6b8ba0d': 'In what year did WWII end?',
  '6eff8172-73d8-4369-b0e9-a8634000fbe9': 'Who starred opposite Kate on the ship?',
  '8ec0a236-6e77-4dab-bcb4-730bd9726bf0': 'What is 9 + 2?',
  '95e59d08-6009-472d-9e12-97cac69833ee': 'In tennis, what score is 0?',
  'fd8dd373-3573-4aab-9821-4397bd38d3c5': 'Who wrote "1984" the dystopian novel?',
  'f8e37c42-f3aa-4a0d-a69d-5167fc963e64': 'Which country is the most populous?',
  'bae3fd6d-4d32-47ce-b521-547e88a87131': 'Which is the fastest animal on land?',
  'd124255b-9242-4cb0-9911-767948582c81': 'What is H2O commonly known as?',
  '87ef9492-6842-4863-90ec-8d59bfad56a6': 'Who starred in "Forrest Gump"?',
  '5831ad8d-73cd-45c5-9ba6-7d9601a481e7': 'Who discovered the Americas?',
  '27b3fbea-fe90-4fdd-8397-e9e8608b9ee1': 'Which is one of the greatest rock bands?',
  '7223d3e2-6be7-4ceb-9bd5-b9564a5baed3': 'What is 9 + 9 × 10?',
  'a942c672-7f75-4284-a25f-30c074ecbf5f': 'How many goals in a regulation football game?',
  'f2de385b-1be4-4f6f-89a8-124b9b8e5953': 'Who wrote "Jane Eyre"?',
  '87092b00-7347-4ae4-92dd-d837287baff4': 'What is the second longest river?',
  '34dca910-6c44-43b2-9a3a-0a89b9d8e295': 'What makes up about 78% of air?',
  'efa91728-17f5-4b40-8833-2335dca6d2d2': 'What film franchise has hobbits?',
  'b80e702c-b60b-4ad7-b57c-931a97a37846': 'How many legs do spiders have?',
  '75c0c230-a716-462a-9a94-4e8020f56004': 'Who is the "Material Girl" singer?',
  'f4ecdfca-8cd6-49ec-a8ec-a68e45a51c37': 'Which empire built the Great Wall of China?',
  '4f1cf48b-3b4e-4d9f-8421-82521f8d7c04': 'Which is the smallest sovereign nation?',
  '7a38cb3f-5e16-44b2-ab69-bc6952baf887': 'What is 15 × 15 + 4 equal to?',
  '73260137-8920-464b-a438-251428b022da': 'What animal lays eggs and has fur?',
  '8f8c88f8-b57b-4af5-b8f9-47dd1ffbf9df': 'Who played Iron Man?',
  '911b5349-58b9-4e97-a6d5-faa43970a789': 'In American football how many players per team?',
  '9fd262c9-1a53-47d0-8939-79b66e7ea127': 'What is the symbol for Gold?',
  'f834c792-32ac-4b50-a89e-f7409592f8dd': 'Who wrote "The Catcher in the Rye"?',
  '6d3b64e0-f491-4db8-967d-1c6a7eb7bf04': 'Which mountain range spans Europe?',
  '17b4393f-1846-49f5-bcdc-42c51dfe66c9': 'What is the largest animal?'
};

async function populateQuestions() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = '752a111e-1154-4a5b-9854-7784320dc6db';

  console.log('Updating questions with proper text...');

  for (const [id, questionText] of Object.entries(questionsMap)) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sql: 'UPDATE questions SET question = ? WHERE id = ?',
            params: [questionText, id]
          })
        }
      );

      if (!response.ok) {
        console.error(`Failed to update ${id}:`, await response.text());
      }
    } catch (error) {
      console.error(`Error updating ${id}:`, error.message);
    }
  }

  console.log('✅ Done!');
}

populateQuestions();
