const Report = require('./report-model');
const { handleErr, acceptableTypes } = require('../util/helpers');

const reportTypes = ['inappropriate', 'spam'];

module.exports = {
  create: (req, res) => {
    const { author, parentId, parentType, reportType } = req.body;
    if (!author || !parentId || !parentType || !acceptableTypes.includes(parentType) || !reportType || !reportTypes.includes(reportType)) {
      return handleErr(res, 400, 'Report could not be accepted. Please try again.', {
        reportType, parentType
      });
    }
    const newReport = new Report({ author, parentId, parentType, reportType});
    newReport.save((err, report) => {
      if (err) {
        return handleErr(res, 500, 'Could not create your report.', err);
      }
      res.json(report);
    })
  },
  remove: (req, res) => {
    Report.findByIdAndRemove(req.params.id, (err, response) => {
      if (err) {
        return handleErr(res, 500);
      }
      res.json(response);
    });
  },
  query: (req, res) => {
    const { parentType, parentId } = req.body;
    if (!parentType || !acceptableTypes.includes(parentType) || !parentId) {
      return handleErr(res, 400, 'Please try your request again. Missing important params', { parentType, parentId });
    }
    Report.find({ parentType, parentId }).exec().then(
      reports => {
        if (!reports || !reports.length) {
          return handleErr(res, 204, 'No reports found.');
        }
        res.json(returnObjectsArray(reports));
      },
      err => handleErr(res, 500, 'Server error retrieving reports', err)
    );
  }
}
