import React from 'react';
import { HelpCircle, Sparkles } from 'lucide-react';

export default function SuggestedQuestions({ activeDataSource, onSelectQuestion }) {
  // Generate 100% dynamic dataset-specific suggested questions based on schema metadata
  const generateSuggestions = () => {
    const tables = activeDataSource?.schemaMetadata?.tables || [];
    if (tables.length === 0) {
      return [
        "Show all records from active table",
        "List top 10 records ordered by ID",
        "Group records by primary category",
        "Filter records by attribute"
      ];
    }

    const mainTable = tables[0];
    const rawTableName = activeDataSource?.name || mainTable.name || 'dataset';
    // Clean up entity name (e.g. "student_database_100_records.xlsx" -> "student")
    const cleanEntity = rawTableName
      .replace(/\.(xlsx|csv|db|sqlite)$/i, '')
      .replace(/_/g, ' ')
      .replace(/database|\d+|records|sample/gi, '')
      .trim() || 'records';

    const cols = (mainTable.columns || []).map(c => c.name);
    const textCols = cols.filter(c => !c.toLowerCase().includes('id') && !c.toLowerCase().includes('date'));
    const numCols = mainTable.columns
      .filter(c => c.type?.toLowerCase().includes('int') || c.type?.toLowerCase().includes('float') || c.type?.toLowerCase().includes('num') || c.name.toLowerCase().includes('amount') || c.name.toLowerCase().includes('score') || c.name.toLowerCase().includes('age') || c.name.toLowerCase().includes('gpa') || c.name.toLowerCase().includes('price') || c.name.toLowerCase().includes('total'))
      .map(c => c.name);

    const nameCol = cols.find(c => c.toLowerCase().includes('name')) || textCols[0];
    const categoryCol = cols.find(c => c.toLowerCase().includes('city') || c.toLowerCase().includes('location') || c.toLowerCase().includes('department') || c.toLowerCase().includes('major') || c.toLowerCase().includes('grade') || c.toLowerCase().includes('category'));
    const metricCol = numCols.find(c => !c.toLowerCase().includes('id')) || numCols[0];

    const suggestions = [];

    // 1. Full Dataset query
    suggestions.push(`Show all ${cleanEntity} records`);

    // 2. Specific Column Query
    if (nameCol) {
      suggestions.push(`Show ${nameCol} from ${cleanEntity}`);
    }

    // 3. Category / Grouping Query
    if (categoryCol) {
      suggestions.push(`Which ${categoryCol} has the highest count of ${cleanEntity}?`);
    }

    // 4. Numeric / Metric Query
    if (metricCol) {
      suggestions.push(`Show top 5 ${cleanEntity} by ${metricCol}`);
    }

    // 5. Multiple Column Query
    if (textCols.length >= 2) {
      suggestions.push(`Show ${textCols[0]} and ${textCols[1]} from ${cleanEntity}`);
    }

    return suggestions.slice(0, 5);
  };

  const suggestions = generateSuggestions();

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 shadow-lg shadow-blue-500/5">
        <Sparkles className="w-6 h-6" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Welcome to DataMind AI</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        Your AI-powered copilot for SQL queries and live database insights.
        {activeDataSource?.name && (
          <span className="block mt-1 text-cyan-400 font-medium">
            Active Dataset: {activeDataSource.name}
          </span>
        )}
      </p>

      <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-sm">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 mb-3 justify-start">
          <HelpCircle className="w-4 h-4 text-blue-400" />
          <span>Suggested questions for active dataset ({activeDataSource?.name || 'Dataset'}):</span>
        </div>

        <div className="flex flex-wrap gap-2 justify-start">
          {suggestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => onSelectQuestion(q)}
              className="text-left text-xs btn-3d-secondary text-blue-300 hover:text-white px-3.5 py-2.5 rounded-xl transition duration-150 cursor-pointer font-medium"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
