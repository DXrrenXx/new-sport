Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const gradeId = url.searchParams.get('grade_id');
        const sportId = url.searchParams.get('sport_id');
        const week = url.searchParams.get('week');
        const status = url.searchParams.get('status');

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        let matchesUrl = `${supabaseUrl}/rest/v1/matches?select=*&order=week.asc,created_at.asc`;
        
        if (gradeId) {
            matchesUrl += `&grade_id=eq.${gradeId}`;
        }
        if (sportId) {
            matchesUrl += `&sport_id=eq.${sportId}`;
        }
        if (week) {
            matchesUrl += `&week=eq.${week}`;
        }
        if (status) {
            matchesUrl += `&status=eq.${status}`;
        }

        const matchesResponse = await fetch(matchesUrl, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!matchesResponse.ok) {
            throw new Error('Failed to fetch matches');
        }

        const matches = await matchesResponse.json();

        const classesResponse = await fetch(`${supabaseUrl}/rest/v1/classes?select=*`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!classesResponse.ok) {
            throw new Error('Failed to fetch classes');
        }

        const classes = await classesResponse.json();

        const sportsResponse = await fetch(`${supabaseUrl}/rest/v1/sports?select=*`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!sportsResponse.ok) {
            throw new Error('Failed to fetch sports');
        }

        const sports = await sportsResponse.json();

        const gradesResponse = await fetch(`${supabaseUrl}/rest/v1/grades?select=*`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!gradesResponse.ok) {
            throw new Error('Failed to fetch grades');
        }

        const grades = await gradesResponse.json();

        const enrichedMatches = matches.map(match => {
            const homeClass = classes.find(c => c.id === match.home_class_id);
            const awayClass = classes.find(c => c.id === match.away_class_id);
            const sport = sports.find(s => s.id === match.sport_id);
            const grade = grades.find(g => g.id === match.grade_id);

            return {
                ...match,
                home_class_name: homeClass?.name || 'Unknown',
                away_class_name: awayClass?.name || 'Unknown',
                sport_name: sport?.name || 'Unknown',
                grade_name: grade?.name || 'Unknown'
            };
        });

        const weeks = [...new Set(matches.map(m => m.week))].sort((a, b) => a - b);

        return new Response(JSON.stringify({
            data: {
                matches: enrichedMatches,
                weeks,
                classes,
                sports,
                grades
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Get schedule error:', error);

        const errorResponse = {
            error: {
                code: 'GET_SCHEDULE_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
