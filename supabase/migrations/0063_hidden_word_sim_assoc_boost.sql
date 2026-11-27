-- 0063 · (사용자: 연상 관련어도 올려줘 — 의사·청진기, 데이터·컴퓨터 등)
-- 연상/주제 관련어는 의미(임베딩)·문맥(공생) 축이 중간이라 낮게 나옴. 두 축 캘리브레이션을
-- 더 관대하게(center ↓) 조정해 중간 신호를 끌어올린다. 무관어(코사인~0·공생無)는 여전히 낮게 유지.
update public.hw_sim_calibration set center = 0.30, scale = 0.070, updated = now() where axis = 'semantic';
update public.hw_sim_calibration set center = 0.050, scale = 0.032, updated = now() where axis = 'contextual';
