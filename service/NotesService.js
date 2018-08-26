var DbService = require("./dbService");

class NotesService {

    constructor(){
        this.dbService = new DbService();
    }

    getAllTimelineNotesForParticipant(participantId, callback){
        this.dbService.getNotes(participantId, 'TIMELINE', callback);
    }

    saveTimelineNote(participantId, noteText, timelineConfig, callback){
        this.dbService.saveNote(participantId, 'TIMELINE', noteText, timelineConfig, callback);
    }

}
module.exports = NotesService;