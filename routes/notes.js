var express = require('express');
var router = express.Router();
let NotesService = require('../service/NotesService');
let notesServiceInstance = new NotesService();

router.post('/save', (req,res,next) => {

    let participantId = req.user.participant_id;
    let noteText = req.body.inputText;
    let timelineConfig = req.body.timelineConfig;
    let type = req.body.noteType;

            notesServiceInstance.saveTimelineNote(participantId, noteText, JSON.stringify(timelineConfig) , type, success => {
                if (success) {
                    res.status(200).send();
                } else {
                    res.status(500).send();
                }
            });

});

router.get('/get', (req,res,next) => {
    let participantId = req.user.participant_id;
    let type = req.query.type;
    if (!participantId) {
        res.status(400).send('parameter participantId is not set');
        return;
    }

    notesServiceInstance.getAllNotesForParticipant(participantId,type, timelineNotes => {
        res.send(timelineNotes);
    });
});

module.exports = router;