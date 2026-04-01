/**
 * Script pour créer un utilisateur administrateur
 * Usage: node src/scripts/createAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  try {
    // Connexion MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/maintenance_db'
    );
    console.log('Connecté à MongoDB');

    // Demander les informations
    const username = await question("Nom d'utilisateur: ");
    const email = await question('Email: ');
    const password = await question('Mot de passe: ');

    // Vérifier si l'utilisateur existe
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      console.log("L'utilisateur existe déjà!");
      process.exit(1);
    }

    // Créer l'utilisateur
    const user = new User({
      username,
      email,
      password,
      role: 'admin',
    });

    await user.save();
    console.log('Administrateur créé avec succès!');
    console.log(`ID: ${user._id}`);
    console.log(`Username: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error);
    rl.close();
    process.exit(1);
  }
}

createAdmin();

