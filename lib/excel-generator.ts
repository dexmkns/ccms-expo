// DIRECTORY LOCATION: lib/excel-generator.ts

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { MatrixRow, Judge, Criteria, Score } from '@/types/expo';

export const generateExpoExcel = async (
  matrix: MatrixRow[],
  judges: Judge[],
  criteria: Criteria[],
  rawScores: Score[],
  fileName: string
) => {
  // 1. Create a new Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CCMS Expo System';
  workbook.created = new Date();

  // ---------------------------------------------------------
  // SHEET 1: OFFICIAL RANKINGS (Clean, printable)
  // ---------------------------------------------------------
  const rankSheet = workbook.addWorksheet('Official Rankings');
  
  // Set Columns
  rankSheet.columns = [
    { header: 'Rank', key: 'rank', width: 10 },
    { header: 'Team Name', key: 'team', width: 30 },
    { header: 'Booth Code', key: 'code', width: 15 },
    { header: 'Final Score', key: 'score', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
  ];

  // Add Data
  matrix.forEach((row, index) => {
    rankSheet.addRow({
      rank: index + 1,
      team: row.participant.real_name,
      code: row.participant.booth_code,
      score: row.finalAverage,
      status: index < 3 ? 'WINNER' : 'Finalist', // Simple logic for top 3
    });
  });

  // Styling Header
  rankSheet.getRow(1).font = { bold: true, size: 12 };
  rankSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // ---------------------------------------------------------
  // SHEET 2: JUDGE MATRIX (Transparency View)
  // ---------------------------------------------------------
  const matrixSheet = workbook.addWorksheet('Judge Validation Matrix');
  
  // Dynamic Columns based on Judges
  const judgeColumns = judges.map(j => ({ header: `Judge: ${j.name}`, key: `judge_${j.judge_id}`, width: 20 }));
  
  matrixSheet.columns = [
    { header: 'Team Name', key: 'team', width: 30 },
    ...judgeColumns,
    { header: 'Variance', key: 'variance', width: 15 },
    { header: 'Average', key: 'average', width: 15 },
  ];

  matrix.forEach((row) => {
    const rowData: any = {
      team: row.participant.real_name,
      variance: row.variance,
      average: row.finalAverage,
    };
    
    // Fill in dynamic judge scores
    judges.forEach(j => {
      rowData[`judge_${j.judge_id}`] = row.judgeScores[j.judge_id] || '-';
    });

    const newRow = matrixSheet.addRow(rowData);

    // Conditional Formatting for High Variance (Manual Simulation)
    if (row.variance > 15) {
      newRow.getCell('variance').font = { color: { argb: 'FFFF0000' }, bold: true };
    }
  });
  
  matrixSheet.getRow(1).font = { bold: true };


  // ---------------------------------------------------------
  // SHEET 3: RAW DATA AUDIT (Deep Dive)
  // ---------------------------------------------------------
  const auditSheet = workbook.addWorksheet('Raw Score Audit');
  
  auditSheet.columns = [
    { header: 'Timestamp', key: 'time', width: 20 },
    { header: 'Judge Name', key: 'judge', width: 20 },
    { header: 'Team Name', key: 'team', width: 25 },
    { header: 'Criteria', key: 'crit', width: 25 },
    { header: 'Weight %', key: 'weight', width: 10 },
    { header: 'Score Given', key: 'val', width: 10 },
    { header: 'Weighted Calc', key: 'calc', width: 15 },
  ];

  // We have to join data manually for this flat view
  rawScores.forEach(s => {
    const j = judges.find(j => j.judge_id === s.judge_id);
    const p = matrix.find(m => m.participant.participant_id === s.participant_id)?.participant;
    const c = criteria.find(c => c.criteria_id === s.criteria_id);

    if (j && p && c) {
        auditSheet.addRow({
            time: new Date().toLocaleDateString(), // In real app, use s.timestamp
            judge: j.name,
            team: p.real_name,
            crit: c.name,
            weight: c.weight_percentage + '%',
            val: s.score_value,
            calc: (s.score_value * c.weight_percentage / 100).toFixed(2)
        });
    }
  });
  
  auditSheet.getRow(1).font = { bold: true };

  // 4. Generate & Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};