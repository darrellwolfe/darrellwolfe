Select
i.RevObjId AS lrsn,
SUM(c.ValueAmount) AS CadValue_TotalAssessed
FROM CadRoll r
JOIN CadLevel l ON r.Id = l.CadRollId
JOIN CadInv i ON l.Id = i.CadLevelId
JOIN tsbv_cadastre AS c 
  On c.CadRollId = r.Id
  And c.CadInvId = i.Id
  And c.ValueType = 109 -- Variable
WHERE r.AssessmentYear = Year(GetDate()) - 1
GROUP BY i.RevObjId