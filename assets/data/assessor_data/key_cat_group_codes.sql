Select
c.tbl_element As Cat_Group_Code,
c.tbl_element_desc As Cat_Description

From codes_table As c
  -- On a.group_code = c.tbl_element

Where c.code_status = 'A'
  And tbl_type_code = 'impgroup'
