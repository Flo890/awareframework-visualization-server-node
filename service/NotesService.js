var DbService = require("./dbService");

class NotesService {

    constructor(){
        this.dbService = new DbService();
    }

    getAllNotesForParticipant(participantId, type, callback){
        this.dbService.getNotes(participantId, type, callback);
    }

    saveTimelineNote(participantId, noteText, timelineConfig, type, callback){
        this.dbService.saveTimelineNote(participantId, type, noteText, timelineConfig, callback);
    }

}
module.exports = NotesService;