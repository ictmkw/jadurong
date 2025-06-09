// Code.gs

const SPREADSHEET_ID = '1c7Ylop4e3y0i1anLbG_KUYTW2jQFZiPHmgzPP3XaQjQ';
const SHEET_NAME = 'HomeVisiting';
const STUDENT_PHOTO_FOLDER_ID = '1AO9qWcMnJcPDsJatnX3Ck2LExRuHZ07J';
const OUTSIDE_HOUSE_PHOTO_FOLDER_ID = '1l6lgcaf7EvB7RIZo4kyobTA9FbC1q22h';
const INSIDE_HOUSE_PHOTO_FOLDER_ID = '1brU2oMJzFAkJhnZ1nOY7AF5xURNuVjG6';
const GOOGLE_SLIDE_TEMPLATE_ID = '1QSYQYZ_OV0YtlGt0igGH2tztAFQYp-p-KcM_wquelwU';

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

/**
 * ฟังก์ชันสำหรับบันทึกข้อมูลการเยี่ยมบ้านลง Google Sheet
 * @param {Object} formData - ข้อมูลจากฟอร์ม
 * @returns {Object} ผลลัพธ์การดำเนินการ
 */
function saveHomeVisitData(formData) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = [];

    // เพิ่ม Timestamp
    formData.Timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

    // จัดเรียงข้อมูลตามลำดับ header
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (formData[header] !== undefined) {
        if (Array.isArray(formData[header])) {
          newRow.push(formData[header].join(', ')); // สำหรับ checkbox หรือ multiple select
        } else {
          newRow.push(formData[header]);
        }
      } else {
        newRow.push(''); // ถ้าไม่มีข้อมูลสำหรับ header นั้นๆ
      }
    }
    sheet.appendRow(newRow);
    return { success: true, message: 'บันทึกข้อมูลสำเร็จ!' };
  } catch (e) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + e.message };
  }
}

/**
 * ฟังก์ชันสำหรับอัปโหลดรูปภาพไปยัง Google Drive
 * @param {string} data - Base64 encoded image data
 * @param {string} fileName - ชื่อไฟล์
 * @param {string} folderId - ID โฟลเดอร์ Google Drive
 * @returns {string} URL ของรูปภาพที่อัปโหลด
 */
function uploadImageToDrive(data, fileName, folderId) {
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(data.split(',')[1]), MimeType.IMAGE_JPEG, fileName);
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // ตั้งค่าให้ทุกคนเข้าถึงได้ด้วยลิงก์
    return file.getUrl();
  } catch (e) {
    console.error("Error uploading image: ", e);
    throw new Error("Failed to upload image: " + e.message);
  }
}

/**
 * ฟังก์ชันสำหรับดึงข้อมูลนักเรียนทั้งหมด
 * @returns {Array} ข้อมูลนักเรียน
 */
function getAllStudentData() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values.shift(); // ดึง header ออก

    const studentData = values.map(row => {
      const rowObject = {};
      headers.forEach((header, index) => {
        rowObject[header] = row[index];
      });
      return rowObject;
    });
    return { success: true, data: studentData };
  } catch (e) {
    return { success: false, message: 'ไม่สามารถดึงข้อมูลนักเรียนได้: ' + e.message };
  }
}

/**
 * ฟังก์ชันสำหรับลบข้อมูลนักเรียน
 * @param {string} studentName - ชื่อนักเรียน
 * @param {string} className - ชั้น
 * @returns {Object} ผลลัพธ์การดำเนินการ
 */
function deleteStudentData(studentName, className) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const nameColIndex = headers.indexOf('StudentName');
    const classColIndex = headers.indexOf('Class');

    if (nameColIndex === -1 || classColIndex === -1) {
      throw new Error('ไม่พบ Header StudentName หรือ Class ใน Sheet');
    }

    let rowIndexToDelete = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][nameColIndex] === studentName && data[i][classColIndex] === className) {
        rowIndexToDelete = i + 1; // +1 เพราะแถวแรกคือ header
        break;
      }
    }

    if (rowIndexToDelete !== -1) {
      sheet.deleteRow(rowIndexToDelete);
      return { success: true, message: 'ลบข้อมูลนักเรียนสำเร็จ!' };
    } else {
      return { success: false, message: 'ไม่พบนักเรียนที่ต้องการลบ' };
    }
  } catch (e) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล: ' + e.message };
  }
}

/**
 * ฟังก์ชันสำหรับอัปเดตข้อมูลนักเรียน
 * @param {string} originalStudentName - ชื่อนักเรียนเดิม (สำหรับค้นหา)
 * @param {string} originalClass - ชั้นเดิม (สำหรับค้นหา)
 * @param {Object} updatedFormData - ข้อมูลที่ต้องการอัปเดต
 * @returns {Object} ผลลัพธ์การดำเนินการ
 */
function updateStudentData(originalStudentName, originalClass, updatedFormData) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const nameColIndex = headers.indexOf('StudentName');
    const classColIndex = headers.indexOf('Class');

    if (nameColIndex === -1 || classColIndex === -1) {
      throw new Error('ไม่พบ Header StudentName หรือ Class ใน Sheet');
    }

    let rowIndexToUpdate = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][nameColIndex] === originalStudentName && data[i][classColIndex] === originalClass) {
        rowIndexToUpdate = i + 1; // +1 เพราะแถวแรกคือ header
        break;
      }
    }

    if (rowIndexToUpdate !== -1) {
      const currentDataRow = sheet.getRange(rowIndexToUpdate, 1, 1, headers.length).getValues()[0];
      const newRow = [];

      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (updatedFormData[header] !== undefined) {
          if (Array.isArray(updatedFormData[header])) {
            newRow.push(updatedFormData[header].join(', '));
          } else {
            newRow.push(updatedFormData[header]);
          }
        } else {
          newRow.push(currentDataRow[i]); // ใช้ข้อมูลเดิมถ้าไม่มีการอัปเดตในฟอร์ม
        }
      }
      sheet.getRange(rowIndexToUpdate, 1, 1, newRow.length).setValues([newRow]);
      return { success: true, message: 'อัปเดตข้อมูลนักเรียนสำเร็จ!' };
    } else {
      return { success: false, message: 'ไม่พบนักเรียนที่ต้องการอัปเดต' };
    }
  } catch (e) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล: ' + e.message };
  }
}


/**
 * ฟังก์ชันสำหรับสร้าง PDF จาก Google Slide Template
 * @param {Object} studentData - ข้อมูลนักเรียน
 * @returns {string} URL ของไฟล์ PDF ที่สร้างขึ้น
 */
function generatePdfFromTemplate(studentData) {
  try {
    const presentation = SlidesApp.openById(GOOGLE_SLIDE_TEMPLATE_ID);
    const slides = presentation.getSlides();

    // สร้างสำเนาของ template
    const newPresentation = presentation.makeCopy(`รายงานเยี่ยมบ้าน_${studentData.StudentName}`, DriveApp.getFolderById('YOUR_OUTPUT_FOLDER_ID')); // **เปลี่ยน 'YOUR_OUTPUT_FOLDER_ID' เป็น Folder ID ที่คุณต้องการเก็บไฟล์ PDF**
    const newSlides = SlidesApp.openById(newPresentation.getId()).getSlides();
    const newSlide = newSlides[0]; // สมมติว่ามี slide เดียวใน template

    // ตัวอย่างการแทนที่ข้อความใน template (คุณจะต้องระบุ placeholder ใน slide ของคุณ)
    // เช่น ใน slide คุณมี placeholder {{StudentName}}, {{Class}}
    newSlide.replaceAllText('{{StudentName}}', studentData.StudentName || '');
    newSlide.replaceAllText('{{Class}}', studentData.Class || '');
    newSlide.replaceAllText('{{ParentName}}', studentData.ParentName || '');
    // ... แทนที่ข้อมูลอื่นๆ ตามที่คุณต้องการ

    // บันทึกเป็น PDF
    const pdfBlob = newPresentation.getAs(MimeType.PDF);
    const pdfFile = DriveApp.createFile(pdfBlob).setName(`รายงานเยี่ยมบ้าน_${studentData.StudentName}.pdf`);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // ลบสำเนา Presentation ออกไป (ถ้าไม่ต้องการเก็บ)
    DriveApp.getFileById(newPresentation.getId()).setTrashed(true);

    return pdfFile.getUrl();

  } catch (e) {
    console.error("Error generating PDF: ", e);
    throw new Error("Failed to generate PDF: " + e.message);
  }
}


/**
 * ฟังก์ชันสำหรับดึงข้อมูลสรุป Dashboard
 * @returns {Object} ข้อมูลสรุป Dashboard
 */
function getDashboardSummary() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const studentRecords = data.slice(1); // ข้อมูลนักเรียนทั้งหมด

    const totalStudents = 419;
    const visitedStudents = studentRecords.length;
    const visitPercentage = totalStudents > 0 ? ((visitedStudents / totalStudents) * 100).toFixed(2) : 0;

    // สรุปความก้าวหน้าแต่ละชั้น
    const classInfo = {
      'ประถมศึกษาปีที่ 1': 29,
      'ประถมศึกษาปีที่ 2': 51,
      'ประถมศึกษาปีที่ 3': 49,
      'ประถมศึกษาปีที่ 4': 52,
      'ประถมศึกษาปีที่ 5': 58,
      'ประถมศึกษาปีที่ 6': 49,
      'มัธยมศึกษาปีที่ 1': 43,
      'มัธยมศึกษาปีที่ 2': 47,
      'มัธยมศึกษาปีที่ 3': 41,
    };

    const classVisitSummary = {};
    for (const className in classInfo) {
      classVisitSummary[className] = { total: classInfo[className], visited: 0, percentage: 0 };
    }

    const classColIndex = headers.indexOf('Class');
    studentRecords.forEach(row => {
      const studentClass = row[classColIndex].split('/')[0]; // เช่น 'ประถมศึกษาปีที่ 1/1' -> 'ประถมศึกษาปีที่ 1'
      if (classVisitSummary[studentClass]) {
        classVisitSummary[studentClass].visited++;
      }
    });

    for (const className in classVisitSummary) {
      const summary = classVisitSummary[className];
      summary.percentage = summary.total > 0 ? ((summary.visited / summary.total) * 100).toFixed(2) : 0;
    }

    // สรุปความเสี่ยง (จาก Tab 5 ทุกข้อ)
    const riskSummary = {};
    const riskHeaders = [
      'TeacherSummary_FamilyCondition', 'TeacherSummary_ParentsDeceased', 'TeacherSummary_ParentDeceased',
      'TeacherSummary_ParentsDivorced', 'TeacherSummary_NotWithParents', 'TeacherSummary_AcademicIssue',
      'TeacherSummary_HealthIssue', 'TeacherSummary_SubstanceAbuseIssue', 'TeacherSummary_ViolenceIssue',
      'TeacherSummary_TravelIssue', 'TeacherSummary_SexualIssue', 'TeacherSummary_GameAddictionIssue',
      'TeacherSummary_EconomicIssue', 'TeacherSummary_OtherIssue', 'TeacherSummary_UrgentHelpNeeded'
    ];

    riskHeaders.forEach(header => {
      riskSummary[header] = { count: 0, percentage: 0 };
    });

    studentRecords.forEach(row => {
      riskHeaders.forEach(header => {
        const colIndex = headers.indexOf(header);
        if (colIndex !== -1 && row[colIndex] === 'ใช่' || row[colIndex] === true) { // หรือค่าอื่นๆ ที่คุณใช้ระบุว่ามีความเสี่ยง
          riskSummary[header].count++;
        }
      });
    });

    for (const header in riskSummary) {
      riskSummary[header].percentage = totalStudents > 0 ? ((riskSummary[header].count / totalStudents) * 100).toFixed(2) : 0;
    }

    return {
      success: true,
      data: {
        totalStudents: totalStudents,
        visitedStudents: visitedStudents,
        visitPercentage: visitPercentage,
        classVisitSummary: classVisitSummary,
        riskSummary: riskSummary
      }
    };

  } catch (e) {
    return { success: false, message: 'ไม่สามารถดึงข้อมูล Dashboard ได้: ' + e.message };
  }
}
