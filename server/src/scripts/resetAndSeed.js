const connectDb = require('../config/db');
const generateRandomData = require('./generateRandomData');

async function resetAndSeed() {
    const db = connectDb();

    console.log('🗑️ Suppression des anciennes données...');

    try {
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("DELETE FROM measurements", (err) => {
                    if (err) console.error('Erreur suppression measurements:', err);
                });
                db.run("DELETE FROM alerts", (err) => {
                    if (err) console.error('Erreur suppression alerts:', err);
                });
                db.run("DELETE FROM devices", (err) => {
                    if (err) console.error('Erreur suppression devices:', err);
                    else resolve();
                });
            });
        });

        console.log('✅ Données supprimées.');
        console.log('🌱 Démarrage de la génération de nouvelles données cohérentes...');

        await generateRandomData();

        console.log('🏁 Réinitialisation terminée !');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur lors de la réinitialisation:', error);
        process.exit(1);
    }
}

resetAndSeed();
