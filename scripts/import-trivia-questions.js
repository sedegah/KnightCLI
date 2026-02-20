/**
 * Import questions from Open Trivia Database API
 * Fetches, normalizes, and inserts questions into D1
 */

// HTML entity decoder
function decodeHTMLEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&nbsp;': ' '
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // Decode numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return decoded;
}

// Shuffle array
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Assign points based on difficulty
function getPoints(difficulty) {
  switch (difficulty.toLowerCase()) {
    case 'easy': return 10;
    case 'medium': return 20;
    case 'hard': return 30;
    default: return 15;
  }
}

// Normalize question for our database
function normalizeQuestion(triviaQuestion) {
  const id = crypto.randomUUID();
  const question = decodeHTMLEntities(triviaQuestion.question);
  const category = decodeHTMLEntities(triviaQuestion.category);
  const difficulty = triviaQuestion.difficulty;
  const points = getPoints(difficulty);
  
  let options, correctIndex;
  
  if (triviaQuestion.type === 'boolean') {
    // Boolean questions: convert to 2 options
    options = ['True', 'False'];
    correctIndex = options.indexOf(triviaQuestion.correct_answer);
    // Add two dummy options for our 4-option format
    options.push('N/A', 'N/A');
  } else {
    // Multiple choice: shuffle correct answer with incorrect ones
    const allAnswers = [
      triviaQuestion.correct_answer,
      ...triviaQuestion.incorrect_answers
    ].map(decodeHTMLEntities);
    
    options = shuffle(allAnswers);
    correctIndex = options.indexOf(decodeHTMLEntities(triviaQuestion.correct_answer));
  }
  
  return {
    id,
    question,
    option_a: options[0],
    option_b: options[1],
    option_c: options[2],
    option_d: options[3] || 'N/A',
    correct: correctIndex, // 0-based index (0, 1, 2, or 3) for A, B, C, D
    category,
    difficulty,
    points,
    is_active: true
  };
}

async function fetchAndImportQuestions(amount = 50) {
  try {
    console.log(`Fetching ${amount} questions from Open Trivia Database...`);
    
    const response = await fetch(`https://opentdb.com/api.php?amount=${amount}`);
    const data = await response.json();
    
    if (data.response_code !== 0) {
      throw new Error(`API error: ${data.response_code}`);
    }
    
    console.log(`✅ Fetched ${data.results.length} questions`);
    
    // Normalize questions
    const normalizedQuestions = data.results.map(normalizeQuestion);
    
    // Generate SQL for batch insert
    const insertStatements = normalizedQuestions.map(q => {
      return {
        sql: `INSERT INTO questions (id, question, option_a, option_b, option_c, option_d, correct, category, difficulty, points, is_active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        params: [
          q.id,
          q.question,
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d,
          q.correct,
          q.category,
          q.difficulty,
          q.points,
          q.is_active ? 1 : 0
        ]
      };
    });
    
    // Save to file for wrangler d1 execute
    const sqlFile = normalizedQuestions.map(q => {
      const escapeSQL = (str) => str.replace(/'/g, "''");
      return `INSERT INTO questions (id, question, option_a, option_b, option_c, option_d, correct, category, difficulty, points, is_active, created_at, updated_at)
VALUES ('${q.id}', '${escapeSQL(q.question)}', '${escapeSQL(q.option_a)}', '${escapeSQL(q.option_b)}', '${escapeSQL(q.option_c)}', '${escapeSQL(q.option_d)}', ${q.correct}, '${escapeSQL(q.category)}', '${q.difficulty}', ${q.points}, ${q.is_active ? 1 : 0}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`;
    }).join('\n\n');
    
    // Write to file
    const fs = await import('fs/promises');
    await fs.writeFile('database/imported-questions.sql', sqlFile);
    
    console.log('\n✅ Generated SQL file: database/imported-questions.sql');
    console.log(`📊 Questions by difficulty:`);
    
    const stats = normalizedQuestions.reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(stats).forEach(([diff, count]) => {
      console.log(`   ${diff}: ${count} (${getPoints(diff)} points each)`);
    });
    
    console.log(`\n📚 Questions by category:`);
    const categories = normalizedQuestions.reduce((acc, q) => {
      acc[q.category] = (acc[q.category] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}`);
      });
    
    console.log('\n🚀 To import into D1, run:');
    console.log('   npx wrangler d1 execute gnex-db-dev --remote --file=database/imported-questions.sql');
    
    return normalizedQuestions;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Get amount from command line or default to 50
const amount = process.argv[2] ? parseInt(process.argv[2]) : 50;

if (amount < 1 || amount > 50) {
  console.error('❌ Amount must be between 1 and 50');
  process.exit(1);
}

fetchAndImportQuestions(amount)
  .then(() => {
    console.log('\n✅ Import preparation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
