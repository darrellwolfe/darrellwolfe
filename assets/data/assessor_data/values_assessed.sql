Select
i.RevObjId As lrsn,
Sum(c.ValueAmount) As CadValue_TotalAssessed

From CadRoll r
Join CadLevel l On r.Id = l.CadRollId
Join CadInv i On l.Id = i.CadLevelId
Join tsbv_cadastre As c
  On c.CadRollId = r.Id
  And c.CadInvId = i.Id
  And c.ValueType = 109 -- Variable

Where r.AssessmentYear = Year(GetDate()) - 1

Group By
i.RevObjId
